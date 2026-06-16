import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TipoEnum = z.enum(["pdf", "docx", "txt"]);

async function assertSuperAdmin(context: any) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "super_admin",
  });
  if (!isAdmin) throw new Error("Acesso negado.");
}

export const listarDocumentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("base_conhecimento")
      .select("id, nome, categoria, tipo, tamanho_bytes, status, erro_mensagem, criado_em")
      .order("criado_em", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const CriarInput = z.object({
  nome: z.string().min(1),
  categoria: z.string().optional().nullable(),
  arquivo_path: z.string().min(1),
  tipo: TipoEnum,
  tamanho_bytes: z.number().int().nonnegative().optional(),
});

export const criarDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CriarInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: doc, error } = await supabaseAdmin
      .from("base_conhecimento")
      .insert({
        nome: data.nome,
        categoria: data.categoria ?? null,
        arquivo_path: data.arquivo_path,
        tipo: data.tipo,
        tamanho_bytes: data.tamanho_bytes ?? null,
        status: "processando",
        criado_por: context.userId,
      })
      .select("id")
      .single();
    if (error || !doc) throw new Error(error?.message ?? "Falha ao criar documento.");

    // Process synchronously (caller awaits)
    try {
      await processarDocumentoInterno(doc.id);
    } catch (e: any) {
      await supabaseAdmin
        .from("base_conhecimento")
        .update({ status: "erro", erro_mensagem: String(e?.message ?? e).slice(0, 500) })
        .eq("id", doc.id);
    }
    return { id: doc.id };
  });

const ExcluirInput = z.object({ id: z.string().uuid() });

export const excluirDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ExcluirInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: doc } = await supabaseAdmin
      .from("base_conhecimento")
      .select("arquivo_path")
      .eq("id", data.id)
      .maybeSingle();
    if (doc?.arquivo_path) {
      await supabaseAdmin.storage.from("agente-uploads").remove([doc.arquivo_path]);
    }
    const { error } = await supabaseAdmin
      .from("base_conhecimento")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function processarDocumentoInterno(documentoId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { extrairTexto, chunkText, gerarEmbeddings } = await import(
    "@/lib/base-conhecimento.server"
  );

  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY ausente.");

  const { data: doc, error: dErr } = await supabaseAdmin
    .from("base_conhecimento")
    .select("id, arquivo_path, tipo")
    .eq("id", documentoId)
    .maybeSingle();
  if (dErr || !doc) throw new Error("Documento não encontrado.");

  const { data: blob, error: dlErr } = await supabaseAdmin.storage
    .from("agente-uploads")
    .download(doc.arquivo_path);
  if (dlErr || !blob) throw new Error("Falha ao baixar arquivo.");

  const ab = await blob.arrayBuffer();
  const texto = await extrairTexto(doc.tipo as any, ab);
  if (!texto.trim()) throw new Error("Documento sem texto extraído.");

  const chunks = chunkText(texto);
  if (!chunks.length) throw new Error("Não foi possível dividir o documento em chunks.");

  const embeddings = await gerarEmbeddings(chunks, key);
  if (embeddings.length !== chunks.length) {
    throw new Error("Inconsistência entre chunks e embeddings.");
  }

  // Remove any existing chunks for this doc, then insert fresh
  await supabaseAdmin.from("base_conhecimento_chunks").delete().eq("documento_id", documentoId);

  const rows = chunks.map((conteudo, i) => ({
    documento_id: documentoId,
    conteudo,
    embedding: embeddings[i] as any,
    posicao: i,
    tokens: Math.round(conteudo.length / 4),
  }));

  // Insert in batches of 100
  for (let i = 0; i < rows.length; i += 100) {
    const slice = rows.slice(i, i + 100);
    const { error: insErr } = await supabaseAdmin
      .from("base_conhecimento_chunks")
      .insert(slice as any);
    if (insErr) throw new Error(insErr.message);
  }

  await supabaseAdmin
    .from("base_conhecimento")
    .update({ status: "pronto", erro_mensagem: null })
    .eq("id", documentoId);
}

/** Server-only helper: search the knowledge base by free-text query. */
export async function buscarContextoRelevante(
  texto: string,
  topK = 5,
  threshold = 0.5,
): Promise<{ conteudo: string; similarity: number }[]> {
  if (!texto?.trim()) return [];
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return [];
  try {
    const { gerarEmbedding } = await import("@/lib/base-conhecimento.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const embedding = await gerarEmbedding(texto, key);
    const { data, error } = await supabaseAdmin.rpc("buscar_conhecimento", {
      query_embedding: embedding as any,
      match_count: topK,
      similarity_threshold: threshold,
    });
    if (error) {
      console.error("[buscar_conhecimento]", error.message);
      return [];
    }
    return (data ?? []).map((r: any) => ({
      conteudo: r.conteudo as string,
      similarity: r.similarity as number,
    }));
  } catch (e) {
    console.error("[buscarContextoRelevante]", e);
    return [];
  }
}
