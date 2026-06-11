import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({ casoId: z.string().uuid() });

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, Array.from(sub) as unknown as number[]);
  }
  return btoa(binary);
}

function slugify(s: string): string {
  return (s || "documento")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60) || "documento";
}

export const gerarPdfMapeamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildMapeamentoPdf } = await import("@/lib/pdf-mapeamento.server");
    const userSupa = context.supabase;

    // 1) Caso + relações
    const { data: caso, error: cErr } = await userSupa
      .from("casos")
      .select(
        "id, codigo, agendado_em, agente:profiles!agente_id(nome, email), formulario_id, unidade:unidades(nome, cep, logradouro, numero, bairro, cidade, estado, matriz:matrizes(nome, cnpj, razao_social, cep, logradouro, numero, bairro, cidade, estado, empresa:empresas(nome)))",
      )
      .eq("id", data.casoId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!caso) throw new Error("Caso não encontrado.");
    if (!caso.formulario_id) throw new Error("Caso sem formulário associado.");

    // 2) Formulário + metadados
    const { data: formulario } = await userSupa
      .from("formularios")
      .select("nome, codigo, revisao, data_revisao, elaborado_por, aprovado_por")
      .eq("id", caso.formulario_id)
      .maybeSingle();

    // 3) Configurações da empresa — singleton compartilhado
    const { data: configs } = await supabaseAdmin
      .from("configuracoes_empresa")
      .select(
        "nome_empresa, logo_url, cnpj, telefone, email_contato, endereco, cidade_estado, site",
      )
      .limit(1);
    const config = configs?.[0];

    // 4) Seções
    const { data: secoes } = await userSupa
      .from("secoes")
      .select("id, titulo, ordem, descricao")
      .eq("formulario_id", caso.formulario_id)
      .order("ordem");
    const secoesList = secoes ?? [];
    const secIds = secoesList.map((s) => s.id);

    // 5) Perguntas
    const { data: perguntas } = secIds.length
      ? await userSupa
          .from("perguntas")
          .select("id, secao_id, texto, tipo, ordem, instrucao_agente, condicional_pergunta_id, condicional_operador, condicional_valor")
          .in("secao_id", secIds)
          .order("ordem")
      : { data: [] as any[] };

    const pIds = (perguntas ?? []).map((p: any) => p.id);

    // 6) Opções (para selecao_unica)
    const { data: opcoes } = pIds.length
      ? await userSupa
          .from("opcoes_pergunta")
          .select("id, pergunta_id, texto, ordem")
          .in("pergunta_id", pIds)
          .order("ordem")
      : { data: [] as any[] };
    const opcoesPorPergunta = new Map<string, { id: string; texto: string }[]>();
    for (const o of opcoes ?? []) {
      const arr = opcoesPorPergunta.get(o.pergunta_id) ?? [];
      arr.push({ id: o.id, texto: o.texto });
      opcoesPorPergunta.set(o.pergunta_id, arr);
    }

    // 7) Respostas
    const { data: respostas } = await userSupa
      .from("respostas_agente")
      .select("pergunta_id, valor_texto, arquivo_path, arquivos_paths, transcricao, ia_aprovado")
      .eq("caso_id", caso.id);
    const respostasMap = new Map<string, any>();
    for (const r of respostas ?? []) {
      respostasMap.set(r.pergunta_id, r);
    }

    // 8) Baixar fotos do bucket privado (signed URLs)
    const arquivoPaths: string[] = [];
    for (const p of perguntas ?? []) {
      if (p.tipo === "foto") {
        const r = respostasMap.get(p.id);
        const paths: string[] = Array.isArray(r?.arquivos_paths) && r.arquivos_paths.length
          ? r.arquivos_paths
          : r?.arquivo_path ? [r.arquivo_path] : [];
        for (const pth of paths) arquivoPaths.push(pth);
      }
    }
    const fotos = new Map<string, { bytes: Uint8Array; mime: string }>();
    if (arquivoPaths.length) {
      const { data: signed } = await supabaseAdmin.storage
        .from("agente-uploads")
        .createSignedUrls(arquivoPaths, 60);
      await Promise.all(
        (signed ?? []).map(async (s) => {
          if (!s.signedUrl || !s.path) return;
          try {
            const res = await fetch(s.signedUrl);
            if (!res.ok) return;
            const buf = new Uint8Array(await res.arrayBuffer());
            const mime = res.headers.get("content-type") || "image/jpeg";
            fotos.set(s.path, { bytes: buf, mime });
          } catch {
            // ignora foto que falhar
          }
        }),
      );
    }

    // 9) Logo
    let logoBytes: Uint8Array | null = null;
    let logoMime: string | null = null;
    if (config?.logo_url) {
      try {
        const res = await fetch(config.logo_url);
        if (res.ok) {
          logoBytes = new Uint8Array(await res.arrayBuffer());
          logoMime = res.headers.get("content-type") || "image/png";
        }
      } catch {
        // ignora
      }
    }

    // 10) Monta perguntasPorSecao com opções — pula perguntas cuja condicional não bate
    const norm = (s: string) =>
      (s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
    const condicionalSatisfeita = (p: any): boolean => {
      const refId = p.condicional_pergunta_id;
      if (!refId) return true;
      const op = p.condicional_operador || "igual";
      const esperado = norm(p.condicional_valor ?? "");
      const r = respostasMap.get(refId);
      const valor = norm(r?.valor_texto ?? r?.transcricao ?? "");
      if (op === "diferente") return valor !== esperado;
      if (op === "contem") return esperado.length > 0 && valor.includes(esperado);
      return valor === esperado;
    };
    const secoesParaPdf = secoesList.map((s) => ({
      id: s.id,
      titulo: s.titulo,
      ordem: s.ordem,
      descricao: s.descricao,
      perguntas: (perguntas ?? [])
        .filter((p: any) => p.secao_id === s.id)
        .filter(condicionalSatisfeita)
        .map((p: any) => ({
          id: p.id,
          texto: p.texto,
          tipo: p.tipo,
          ordem: p.ordem,
          instrucao_agente: p.instrucao_agente,
          opcoes: opcoesPorPergunta.get(p.id),
        })),
    }));

    const u: any = caso.unidade;
    const m: any = u?.matriz;
    const e: any = m?.empresa;

    const cliente = e?.nome ?? m?.nome ?? "—";
    const unidade = u?.nome ?? "";
    const dataStr = caso.agendado_em
      ? new Date(caso.agendado_em).toLocaleDateString("pt-BR")
      : "—";

    const pdfBytes = await buildMapeamentoPdf({
      meta: {
        titulo: formulario?.nome ?? "Mapeamento Técnico",
        codigo: caso.codigo ?? formulario?.codigo ?? null,
        revisao: formulario?.revisao ?? null,
        dataRevisao: formulario?.data_revisao ?? null,
        elaboradoPor: formulario?.elaborado_por ?? null,
        aprovadoPor: formulario?.aprovado_por ?? null,
        dataDocumento: dataStr,
        logoBytes,
        logoMime,
        empresa: {
          nome: config?.nome_empresa || "Ionics",
          razaoSocial: config?.nome_empresa || null,
          cnpj: config?.cnpj ?? null,
          telefone: config?.telefone ?? null,
          email: config?.email_contato ?? null,
          endereco: config?.endereco ?? null,
          cidadeEstado: config?.cidade_estado ?? null,
          site: config?.site ?? null,
        },
      },
      identificacao: {
        cliente,
        unidade,
        data: dataStr,
        responsavel: caso.agente?.nome || caso.agente?.email || "—",
        contato: caso.agente?.email || "—",
      },
      secoes: secoesParaPdf,
      respostas: respostasMap,
      fotos,
    });

    const filename = `mapeamento-${slugify(caso.codigo || "caso")}-${slugify(cliente)}.pdf`;
    return {
      filename,
      contentBase64: toBase64(pdfBytes),
      mimeType: "application/pdf",
    };
  });
