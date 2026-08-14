import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { renumerar } from "@/lib/laudo/numeracao";
import { comChaves } from "@/lib/laudo/mesclar";
import type { Achado } from "@/lib/laudo/analise/achados";
import {
  alertasBloqueantes,
  blocosComPendencia,
  rotulosPendencias,
  type BlocoLaudo,
  type ConfirmacaoAlerta,
  type LaudoConteudo,
  type VariaveisLaudo,
} from "@/lib/laudo/tipos";

const CasoInput = z.object({ casoId: z.string().uuid() });

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)) as unknown as number[],
    );
  }
  return btoa(binary);
}

function slugify(s: string): string {
  return (
    (s || "laudo")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 60) || "laudo"
  );
}

/** true quando o valor do cadastro não serve para o cabeçalho do documento. */
function vazio(v: string | null | undefined): boolean {
  const s = (v ?? "").trim();
  return !s || s === "—" || s === "-";
}

/**
 * Valor de cabeçalho respeitando a precedência: resposta explícita do
 * formulário (ou confirmação manual do especialista) vence o cadastro;
 * na falta das duas, usa o que houver em `laudo_variaveis` (proposta/IA).
 */
function valorCabecalho(
  vars: VariaveisLaudo,
  chave: string,
  doCadastro: string | null | undefined,
): string {
  const item = vars[chave];
  const doLaudo = (item?.valor ?? "").trim();
  const explicito = doLaudo && (item?.origem === "formulario" || item?.origem === "manual");
  if (explicito) return doLaudo;
  if (!vazio(doCadastro)) return (doCadastro as string).trim();
  return doLaudo || "—";
}

function metaDoCaso(caso: any) {
  const u = caso.unidade;
  const empresa = u?.matriz?.empresa?.nome ?? u?.matriz?.nome ?? "—";
  const codigo = u?.codigo_ionics ?? u?.matriz?.empresa?.codigo_ionics ?? null;
  return {
    cliente: codigo ? `${empresa} (${codigo})` : empresa,
    unidade: u?.nome ?? "—",
    empresaNome: empresa,
    data: caso.agendado_em ? new Date(caso.agendado_em).toLocaleDateString("pt-BR") : "—",
    agente: caso.agente?.nome || caso.agente?.email || caso.agente_nome_manual || "—",
  };
}

async function lerDocumento(supabase: any, casoId: string) {
  const { data, error } = await supabase
    .from("casos")
    .select("laudo_conteudo")
    .eq("id", casoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const conteudo = (data?.laudo_conteudo ?? null) as LaudoConteudo | null;
  if (!conteudo?.blocos?.length) throw new Error("Documento ainda não gerado para este mapeamento.");
  return conteudo;
}

async function gravarDocumento(supabase: any, casoId: string, conteudo: LaudoConteudo) {
  const final: LaudoConteudo = {
    ...conteudo,
    editado_em: new Date().toISOString(),
    blocos: renumerar(comChaves(conteudo.blocos)),
  };
  const { error } = await supabase
    .from("casos")
    .update({ laudo_conteudo: final as any })
    .eq("id", casoId);
  if (error) throw new Error(error.message);
  return final;
}

/** Extrai variáveis (formulário + IA) e monta os blocos do laudo, preservando edições manuais. */
export const gerarLaudo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => CasoInput.parse(i))
  .handler(async ({ data, context }) => {
    const { montarESalvarLaudo } = await import("@/lib/laudo/montar.server");
    const supabase = context.supabase;
    const { caso, variaveis, conteudo, blocos, conflitos, achados, descartados } =
      await montarESalvarLaudo(supabase, data.casoId);

    return {
      variaveis,
      conteudo,
      conflitos,
      achados,
      descartados,
      pendencias: blocosComPendencia(blocos),
      bloqueios: alertasBloqueantes(blocos).map((a) => a.codigo),
      confirmacoes: (caso.laudo_alertas ?? []) as ConfirmacaoAlerta[],
    };
  });

/** Carrega o laudo já salvo, sem chamar a IA. */
export const carregarLaudo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => CasoInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: caso, error } = await context.supabase
      .from("casos")
      .select("laudo_variaveis, laudo_conteudo, laudo_alertas, laudo_analise")
      .eq("id", data.casoId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const conteudo = (caso?.laudo_conteudo ?? null) as LaudoConteudo | null;
    const { carregarMetaLaudoDoCaso } = await import("@/lib/laudo/meta.server");
    const { meta } = await carregarMetaLaudoDoCaso(context.supabase, data.casoId);
    return {
      variaveis: (caso?.laudo_variaveis ?? {}) as VariaveisLaudo,
      conteudo,
      meta,
      pendencias: conteudo ? blocosComPendencia(conteudo.blocos) : 0,
      bloqueios: conteudo ? alertasBloqueantes(conteudo.blocos).map((a) => a.codigo) : [],
      confirmacoes: (caso?.laudo_alertas ?? []) as unknown as ConfirmacaoAlerta[],
      achados: ((caso?.laudo_analise as any)?.achados ?? []) as Achado[],
      descartados: (((caso?.laudo_analise as any)?.descartados ?? []) as string[]),
    };
  });

/** Aceita ou descarta um achado da análise técnica e remonta o documento. */
export const decidirAchadoLaudo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        casoId: z.string().uuid(),
        chave: z.string().min(1),
        decisao: z.enum(["aceitar", "descartar"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { data: caso, error } = await supabase
      .from("casos")
      .select("laudo_analise")
      .eq("id", data.casoId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const analise = (caso?.laudo_analise ?? {}) as { descartados?: string[] };
    const atuais = new Set(analise.descartados ?? []);
    if (data.decisao === "descartar") atuais.add(data.chave);
    else atuais.delete(data.chave);

    const { error: uErr } = await supabase
      .from("casos")
      .update({ laudo_analise: { ...analise, descartados: Array.from(atuais) } as any })
      .eq("id", data.casoId);
    if (uErr) throw new Error(uErr.message);

    const { montarESalvarLaudo } = await import("@/lib/laudo/montar.server");
    const res = await montarESalvarLaudo(supabase, data.casoId);
    return {
      conteudo: res.conteudo,
      achados: res.achados,
      descartados: res.descartados,
      pendencias: blocosComPendencia(res.blocos),
    };
  });

/** Salva valores confirmados manualmente e remonta os blocos (com mesclagem). */
export const salvarVariaveisLaudo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        casoId: z.string().uuid(),
        valores: z.record(z.string(), z.string()),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { data: atual, error: cErr } = await supabase
      .from("casos")
      .select("laudo_variaveis")
      .eq("id", data.casoId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);

    const variaveis = { ...((atual?.laudo_variaveis ?? {}) as unknown as VariaveisLaudo) };
    for (const [chave, valor] of Object.entries(data.valores)) {
      const v = valor.trim();
      variaveis[chave] = v
        ? { chave, valor: v, origem: "manual", confianca: 1 }
        : { chave, valor: null, origem: "ausente", confianca: 0 };
    }
    const { error: uErr } = await supabase
      .from("casos")
      .update({ laudo_variaveis: variaveis as any })
      .eq("id", data.casoId);
    if (uErr) throw new Error(uErr.message);

    const { montarESalvarLaudo } = await import("@/lib/laudo/montar.server");
    const res = await montarESalvarLaudo(supabase, data.casoId);

    return {
      variaveis: res.variaveis,
      conteudo: res.conteudo,
      conflitos: res.conflitos,
      pendencias: blocosComPendencia(res.blocos),
      bloqueios: alertasBloqueantes(res.blocos).map((a) => a.codigo),
    };
  });

/** Salva o documento editado pelo especialista (blocos completos). */
export const salvarDocumentoLaudo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        casoId: z.string().uuid(),
        blocos: z.array(z.any()).min(1),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const atual = await lerDocumento(supabase, data.casoId).catch(() => null);
    const conteudo = await gravarDocumento(supabase, data.casoId, {
      gerado_em: atual?.gerado_em ?? new Date().toISOString(),
      blocos: data.blocos as unknown as BlocoLaudo[],
    });
    return {
      conteudo,
      pendencias: blocosComPendencia(conteudo.blocos),
    };
  });

/** Resolve um conflito entre a edição manual e o valor gerado pelas regras. */
export const resolverConflitoLaudo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        casoId: z.string().uuid(),
        chave: z.string().min(1),
        decisao: z.enum(["manter_edicao", "atualizar_formulario"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const atual = await lerDocumento(supabase, data.casoId);
    const blocos = atual.blocos.map((b) => {
      if (b.chave !== data.chave) return b;
      if (data.decisao === "manter_edicao") {
        return {
          ...(b as any),
          conteudo_original: b.conflito ?? b.conteudo_original ?? null,
          conflito: null,
        } as BlocoLaudo;
      }
      return {
        ...(b as any),
        ...((b.conflito ?? {}) as any),
        editado_manualmente: false,
        conteudo_original: null,
        conflito: null,
      } as BlocoLaudo;
    });
    const conteudo = await gravarDocumento(supabase, data.casoId, { ...atual, blocos });
    return { conteudo, pendencias: blocosComPendencia(conteudo.blocos) };
  });

/** Restaura o conteúdo original (gerado) de um bloco editado manualmente. */
export const restaurarBlocoLaudo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ casoId: z.string().uuid(), chave: z.string().min(1) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const atual = await lerDocumento(supabase, data.casoId);
    const blocos = atual.blocos.map((b) => {
      if (b.chave !== data.chave) return b;
      const original = (b.conflito ?? b.conteudo_original ?? null) as Record<string, any> | null;
      if (!original) return { ...(b as any), oculto: false } as BlocoLaudo;
      return {
        ...(b as any),
        ...original,
        oculto: false,
        editado_manualmente: false,
        conteudo_original: null,
        conflito: null,
      } as BlocoLaudo;
    });
    const conteudo = await gravarDocumento(supabase, data.casoId, { ...atual, blocos });
    return { conteudo, pendencias: blocosComPendencia(conteudo.blocos) };
  });

/** Registra a decisão sobre um alerta bloqueante (corrigido / ciente do risco). */
export const confirmarAlertaLaudo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        casoId: z.string().uuid(),
        codigo: z.string().min(1),
        decisao: z.enum(["corrigido", "ciente_do_risco"]),
        justificativa: z.string().min(10, "Descreva a justificativa (mín. 10 caracteres)."),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { data: caso, error: cErr } = await supabase
      .from("casos")
      .select("laudo_alertas")
      .eq("id", data.casoId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);

    const { data: perfil } = await supabase
      .from("profiles")
      .select("nome")
      .eq("id", context.userId)
      .maybeSingle();

    const atuais = ((caso?.laudo_alertas ?? []) as unknown as ConfirmacaoAlerta[]).filter(
      (a) => a.codigo !== data.codigo,
    );
    const nova: ConfirmacaoAlerta = {
      codigo: data.codigo,
      decisao: data.decisao,
      justificativa: data.justificativa.trim(),
      confirmado_por: context.userId,
      confirmado_por_nome: perfil?.nome ?? null,
      confirmado_em: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("casos")
      .update({ laudo_alertas: [...atuais, nova] as any })
      .eq("id", data.casoId);
    if (error) throw new Error(error.message);

    return { confirmacoes: [...atuais, nova] };
  });

/**
 * Renderiza o PDF do laudo a partir do documento JÁ SALVO (`casos.laudo_conteudo`).
 * Não remonta, não roda IA e não reexecuta regras: é renderer, não motor.
 */
export const gerarPdfLaudo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  // `remontar` é aceito por compatibilidade, mas ignorado.
  .inputValidator((i) => CasoInput.extend({ remontar: z.boolean().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { buildLaudoPdf } = await import("@/lib/pdf-laudo.server");
    const supabase = context.supabase;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: caso, error } = await supabase
      .from("casos")
      .select(
        "id, codigo, agendado_em, laudo_conteudo, laudo_variaveis, laudo_alertas, agente_nome_manual, formulario_id, agente:profiles!agente_id(nome, email), unidade:unidades(nome, codigo_ionics, matriz:matrizes(nome, empresa:empresas(nome, codigo_ionics)))",
      )
      .eq("id", data.casoId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!caso) throw new Error("Mapeamento não encontrado.");

    const conteudo = caso.laudo_conteudo as unknown as LaudoConteudo | null;
    if (!conteudo?.blocos?.length) {
      throw new Error(
        "O documento ainda não foi gerado. Clique em “Gerar laudo” para criar o rascunho, revise e salve antes de emitir o PDF.",
      );
    }

    const pendencias = blocosComPendencia(conteudo.blocos as BlocoLaudo[]);
    if (pendencias) {
      const rotulos = rotulosPendencias(conteudo.blocos as BlocoLaudo[]);
      throw new Error(
        `O documento possui ${pendencias} pendência(s) [CONFIRMAR]${
          rotulos.length ? `: ${rotulos.join(", ")}` : ""
        }. Abra a etapa “3. Documento”, aba “Pendências”, preencha o valor ou remova o bloco não aplicável, salve a revisão e gere o PDF novamente.`,
      );
    }

    const confirmacoes = (caso.laudo_alertas ?? []) as unknown as ConfirmacaoAlerta[];
    const pendentes = alertasBloqueantes(conteudo.blocos as BlocoLaudo[]).filter(
      (a) => !confirmacoes.some((c) => c.codigo === a.codigo),
    );
    if (pendentes.length) {
      throw new Error(
        `Existem alertas técnicos bloqueantes sem confirmação: ${pendentes.map((p) => p.codigo).join(", ")}. Corrija ou registre ciência do risco antes de emitir o laudo.`,
      );
    }


    const { carregarMetaLaudoDoCaso } = await import("@/lib/laudo/meta.server");
    const { meta } = await carregarMetaLaudoDoCaso(supabase, data.casoId);

    const { data: config } = await supabaseAdmin
      .from("configuracoes_empresa")
      .select("nome_empresa, logo_url")
      .limit(1)
      .maybeSingle();

    let logoBytes: Uint8Array | null = null;
    let logoMime: string | null = null;
    if (config?.logo_url) {
      try {
        const res = await fetch(config.logo_url);
        if (res.ok) {
          logoBytes = new Uint8Array(await res.arrayBuffer());
          logoMime = res.headers.get("content-type");
        }
      } catch {
        /* logo opcional */
      }
    }

    const vars = (caso.laudo_variaveis ?? {}) as unknown as VariaveisLaudo;
    const bytes = await buildLaudoPdf({
      meta: {
        titulo: meta.nomeDocumento,
        codigo: caso.codigo ?? null,
        revisao: meta.revisao,
        empresaNome: config?.nome_empresa || "Ionics",
        logoBytes,
        logoMime,
        cliente: meta.cliente,
        unidade: meta.unidade,
        data: meta.data,
        agente: meta.agente,
        codigoDocumento: meta.codigoDocumento,
        elaboradoPor: vars["elaborado_por"]?.valor || "Sheron Williams",
        aprovadoPor: vars["aprovado_por"]?.valor || "Guilherme Sombrio",
        revisaoDocumento: meta.revisao ?? "01",
        dataRevisao: vars["data_revisao"]?.valor || "02/04/2024",
        analista: meta.analista,
        especialista: meta.especialista,
      },

      blocos: renumerar(conteudo.blocos as BlocoLaudo[]).filter((b) => !b.oculto),
      baseUrl: (() => {
        try {
          return new URL(getRequest().url).origin;
        } catch {
          return null;
        }
      })(),
    });

    return {
      filename: meta.filename,
      contentBase64: toBase64(bytes),
      mimeType: "application/pdf",
    };
  });

/** Fotos do FR-29-10 do caso, com URL assinada, para inserir no documento. */
export const listarFotosLaudo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => CasoInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: respostas, error } = await context.supabase
      .from("respostas_agente")
      .select("arquivo_path, arquivos_paths, tipo, pergunta:perguntas(texto)")
      .eq("caso_id", data.casoId)
      .in("tipo", ["foto", "video"]);
    if (error) throw new Error(error.message);

    const itens: { path: string; legenda: string }[] = [];
    for (const r of respostas ?? []) {
      const legenda = (r as any).pergunta?.texto ?? "Registro fotográfico";
      const paths = [
        ...(((r as any).arquivos_paths ?? []) as string[]),
        ...((r as any).arquivo_path ? [(r as any).arquivo_path as string] : []),
      ];
      for (const p of paths) if (p && !itens.some((i) => i.path === p)) itens.push({ path: p, legenda });
    }
    const fotos = itens.filter((i) => !/\.(mp4|mov|webm|avi)$/i.test(i.path));
    if (!fotos.length) return [] as { path: string; url: string; legenda: string }[];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed } = await supabaseAdmin.storage
      .from("agente-uploads")
      .createSignedUrls(fotos.map((f) => f.path), 60 * 60);
    const mapa = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
    return fotos
      .map((f) => ({ ...f, url: (mapa.get(f.path) as string) ?? "" }))
      .filter((f) => f.url);
  });
