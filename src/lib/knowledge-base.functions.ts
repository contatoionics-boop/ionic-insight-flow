import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  KNOWLEDGE_CATEGORIAS,
  KNOWLEDGE_CLASSIFICACOES,
  normalizeClassificacao,
  normalizeTags,
  type KnowledgeCategoria,
  type KnowledgeClassificacao,
} from "@/lib/knowledge-base";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5000;

async function assertSuperAdmin(context: any) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "super_admin",
  });
  if (!isAdmin) throw new Error("Acesso negado.");
}

const CategoriaZ = z.enum(KNOWLEDGE_CATEGORIAS as unknown as [KnowledgeCategoria, ...KnowledgeCategoria[]]);
const ClassificacaoZ = z.enum(KNOWLEDGE_CLASSIFICACOES as unknown as [KnowledgeClassificacao, ...KnowledgeClassificacao[]]);

// ---------- Listagem ----------

const ListarInput = z.object({
  busca: z.string().optional(),
  categoria: CategoriaZ.optional().nullable(),
  classificacao: ClassificacaoZ.optional().nullable(),
  tags: z.array(z.string()).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
});

export const listarRegistros = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ListarInput.parse(i ?? {}))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    let q = supabaseAdmin
      .from("knowledge_base")
      .select(
        "id, categoria, titulo, conteudo, tags, classificacao, fonte, importacao_id, created_at, updated_at",
        { count: "exact" },
      )
      .order("updated_at", { ascending: false })
      .range(from, to);
    if (data.busca) q = q.or(`titulo.ilike.%${data.busca}%,conteudo.ilike.%${data.busca}%`);
    if (data.categoria) q = q.eq("categoria", data.categoria);
    if (data.classificacao) q = q.eq("classificacao", data.classificacao);
    if (data.tags && data.tags.length) q = q.overlaps("tags", data.tags);
    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0 };
  });

// ---------- CRUD ----------

const RegistroInput = z.object({
  titulo: z.string().min(1).max(500),
  conteudo: z.string().min(1),
  categoria: CategoriaZ,
  classificacao: ClassificacaoZ.default("OK"),
  tags: z.array(z.string()).default([]),
  fonte: z.string().optional().nullable(),
});

async function gerarEmbeddingSafe(texto: string): Promise<number[] | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;
  try {
    const { gerarEmbedding } = await import("@/lib/base-conhecimento.server");
    return await gerarEmbedding(texto, key);
  } catch (e) {
    console.error("[knowledge_base embedding]", e);
    return null;
  }
}

export const criarRegistro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => RegistroInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const embedding = await gerarEmbeddingSafe(`${data.titulo}\n\n${data.conteudo}`);
    const { data: row, error } = await supabaseAdmin
      .from("knowledge_base")
      .insert({
        ...data,
        fonte: data.fonte ?? null,
        embedding: embedding as any,
        criado_por: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

const AtualizarInput = RegistroInput.extend({ id: z.string().uuid() });

export const atualizarRegistro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => AtualizarInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...rest } = data;
    const embedding = await gerarEmbeddingSafe(`${rest.titulo}\n\n${rest.conteudo}`);
    const { error } = await supabaseAdmin
      .from("knowledge_base")
      .update({ ...rest, fonte: rest.fonte ?? null, embedding: embedding as any })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const excluirRegistro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("knowledge_base").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Importações ----------

export const listarImportacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("knowledge_base_importacoes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const excluirImportacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Cascade apaga registros via FK ON DELETE CASCADE
    const { error } = await supabaseAdmin
      .from("knowledge_base_importacoes")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Templates ----------

const TEMPLATE_ROWS = [
  {
    titulo: "Exemplo: Pintura externa",
    conteudo: "Descrição detalhada do item / regra / texto padrão.",
    categoria: "catalogo_produtos",
    classificacao: "OK",
    tags: "pintura,externa",
    fonte: "Manual interno v1",
  },
  {
    titulo: "Exemplo: Bloqueio de uso",
    conteudo: "Texto explicando a condição de bloqueio.",
    categoria: "regras_tecnicas",
    classificacao: "BLOQUEIO",
    tags: "uso,segurança",
    fonte: "",
  },
];

export const baixarTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ tipo: z.enum(["csv", "json"]) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    if (data.tipo === "json") {
      return { conteudo: JSON.stringify(TEMPLATE_ROWS, null, 2), mime: "application/json" };
    }
    const headers = ["titulo", "conteudo", "categoria", "classificacao", "tags", "fonte"];
    const lines = [headers.join(",")];
    for (const r of TEMPLATE_ROWS) {
      lines.push(
        headers
          .map((h) => {
            const v = String((r as any)[h] ?? "");
            return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
          })
          .join(","),
      );
    }
    return { conteudo: lines.join("\n"), mime: "text/csv" };
  });

// ---------- Importação ----------

const ImportarInput = z.object({
  arquivo_path: z.string().min(1),
  nome_arquivo: z.string().min(1),
  tipo: z.enum(["json", "csv", "xlsx"]),
});

type LinhaBruta = Record<string, unknown>;

async function parseLinhas(
  tipo: "json" | "csv" | "xlsx",
  buffer: ArrayBuffer,
): Promise<LinhaBruta[]> {
  if (tipo === "json") {
    const txt = new TextDecoder().decode(buffer);
    const parsed = JSON.parse(txt);
    if (!Array.isArray(parsed)) throw new Error("JSON deve ser uma lista de objetos.");
    return parsed as LinhaBruta[];
  }
  if (tipo === "csv") {
    const Papa: any = await import("papaparse");
    const txt = new TextDecoder().decode(buffer);
    const res = (Papa.default ?? Papa).parse(txt, { header: true, skipEmptyLines: true });
    if (res.errors?.length) {
      throw new Error(`CSV inválido: ${res.errors[0].message}`);
    }
    return res.data as LinhaBruta[];
  }
  // xlsx
  const XLSX: any = await import("xlsx");
  const lib = XLSX.default ?? XLSX;
  const wb = lib.read(new Uint8Array(buffer), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return lib.utils.sheet_to_json(ws, { defval: "" }) as LinhaBruta[];
}

export const importarRegistros = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ImportarInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Cria importação em "processando"
    const { data: imp, error: impErr } = await supabaseAdmin
      .from("knowledge_base_importacoes")
      .insert({
        nome_arquivo: data.nome_arquivo,
        tipo: data.tipo,
        status: "processando",
        criado_por: context.userId,
      })
      .select("id")
      .single();
    if (impErr || !imp) throw new Error(impErr?.message ?? "Falha ao criar importação.");

    const finalizar = async (
      status: "pronto" | "erro",
      patch: Record<string, unknown> = {},
    ) => {
      await supabaseAdmin
        .from("knowledge_base_importacoes")
        .update({ status, ...patch })
        .eq("id", imp.id);
    };

    try {
      const { data: blob, error: dlErr } = await supabaseAdmin.storage
        .from("agente-uploads")
        .download(data.arquivo_path);
      if (dlErr || !blob) throw new Error("Falha ao baixar arquivo.");

      const ab = await blob.arrayBuffer();
      if (ab.byteLength > MAX_BYTES) {
        throw new Error("Arquivo maior que 5 MB. Divida em arquivos menores.");
      }

      const linhas = await parseLinhas(data.tipo, ab);
      if (linhas.length === 0) throw new Error("Arquivo vazio ou sem registros válidos.");
      if (linhas.length > MAX_ROWS) {
        throw new Error(
          `Arquivo com ${linhas.length} linhas excede o limite de ${MAX_ROWS}. Divida em partes menores.`,
        );
      }

      const erros: { linha: number; motivo: string }[] = [];
      const validas: {
        titulo: string;
        conteudo: string;
        categoria: KnowledgeCategoria;
        classificacao: KnowledgeClassificacao;
        tags: string[];
        fonte: string | null;
      }[] = [];

      linhas.forEach((raw, idx) => {
        const linha = idx + 2; // header = 1
        const titulo = String(raw.titulo ?? "").trim();
        const conteudo = String(raw.conteudo ?? "").trim();
        const categoria = String(raw.categoria ?? "").trim() as KnowledgeCategoria;
        if (!titulo) return erros.push({ linha, motivo: "titulo vazio" });
        if (!conteudo) return erros.push({ linha, motivo: "conteudo vazio" });
        if (!KNOWLEDGE_CATEGORIAS.includes(categoria as any))
          return erros.push({ linha, motivo: `categoria inválida: "${categoria}"` });
        const classRaw = raw.classificacao;
        const classificacao =
          classRaw == null || classRaw === ""
            ? "OK"
            : normalizeClassificacao(classRaw);
        if (!classificacao)
          return erros.push({ linha, motivo: `classificacao inválida: "${String(classRaw)}"` });
        validas.push({
          titulo,
          conteudo,
          categoria,
          classificacao,
          tags: normalizeTags(raw.tags),
          fonte: raw.fonte ? String(raw.fonte) : null,
        });
      });

      if (validas.length === 0) {
        throw new Error("Nenhum registro válido encontrado no arquivo.");
      }

      // Embeddings em lotes de 32
      const key = process.env.LOVABLE_API_KEY;
      const { gerarEmbeddings } = await import("@/lib/base-conhecimento.server");
      const textos = validas.map((v) => `${v.titulo}\n\n${v.conteudo}`);
      let embeddings: (number[] | null)[] = validas.map(() => null);
      if (key) {
        try {
          const out = await gerarEmbeddings(textos, key);
          if (out.length === textos.length) embeddings = out;
        } catch (e) {
          console.error("[knowledge_base embeddings batch]", e);
        }
      }

      // Insere em lotes de 100
      let inseridos = 0;
      for (let i = 0; i < validas.length; i += 100) {
        const slice = validas.slice(i, i + 100).map((v, j) => ({
          ...v,
          embedding: embeddings[i + j] as any,
          importacao_id: imp.id,
          criado_por: context.userId,
        }));
        const { error: insErr } = await supabaseAdmin
          .from("knowledge_base")
          .insert(slice as any);
        if (insErr) throw new Error(insErr.message);
        inseridos += slice.length;
      }

      await finalizar("pronto", {
        total_registros: linhas.length,
        total_inseridos: inseridos,
        erro_mensagem: erros.length
          ? `${erros.length} linha(s) ignorada(s). Ex.: linha ${erros[0].linha}: ${erros[0].motivo}`
          : null,
      });

      return { importacao_id: imp.id, inseridos, ignorados: erros.length, erros: erros.slice(0, 10) };
    } catch (e: any) {
      const msg = String(e?.message ?? e).slice(0, 500);
      await finalizar("erro", { erro_mensagem: msg });
      throw new Error(msg);
    }
  });

// ---------- Busca para IA ----------

export async function buscarKnowledgeBase(
  texto: string,
  topK = 5,
  threshold = 0.5,
): Promise<
  {
    titulo: string;
    conteudo: string;
    categoria: string;
    classificacao: string;
    tags: string[];
    fonte: string | null;
    similarity: number;
  }[]
> {
  if (!texto?.trim()) return [];
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return [];
  try {
    const { gerarEmbedding } = await import("@/lib/base-conhecimento.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const embedding = await gerarEmbedding(texto, key);
    const { data, error } = await supabaseAdmin.rpc("buscar_knowledge_base", {
      query_embedding: embedding as any,
      match_count: topK,
      similarity_threshold: threshold,
    });
    if (error) {
      console.error("[buscar_knowledge_base]", error.message);
      return [];
    }
    return (data ?? []) as any;
  } catch (e) {
    console.error("[buscarKnowledgeBase]", e);
    return [];
  }
}
