import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PropostaResumo, ResultadoComparacao } from "@/lib/proposta/tipos";
import { normalizarEscopo } from "@/lib/proposta/tipos";

const CasoInput = z.object({ casoId: z.string().uuid() });

const RegistrarInput = z
  .object({
    casoId: z.string().uuid(),
    origem: z.enum(["pdf", "manual"]).default("pdf"),
    arquivoNome: z.string().min(1).max(300).optional().nullable(),
    arquivoPath: z.string().min(1).max(500).optional().nullable(),
    tamanhoBytes: z.number().int().nonnegative().optional().nullable(),
    /** texto livre do analista, quando origem é "manual" */
    textoManual: z.string().min(1).max(20000).optional().nullable(),
    /** escopo já analisado/corrigido no agendamento — evita reextrair */
    escopo: z.record(z.string(), z.any()).optional().nullable(),
  })
  .refine((v) => v.origem !== "pdf" || (!!v.arquivoNome && !!v.arquivoPath), {
    message: "arquivoNome e arquivoPath são obrigatórios para propostas em PDF.",
  })
  .refine((v) => v.origem !== "manual" || !!v.textoManual?.trim(), {
    message: "textoManual é obrigatório para escopo informado manualmente.",
  });

function normalizarProposta(row: any): PropostaResumo {
  return {
    id: row.id,
    caso_id: row.caso_id,
    arquivo_nome: row.arquivo_nome ?? null,
    arquivo_path: row.arquivo_path ?? null,
    tamanho_bytes: row.tamanho_bytes ?? null,
    status: row.status,
    erro_mensagem: row.erro_mensagem ?? null,
    escopo: normalizarEscopo(row.escopo),
    criado_em: row.criado_em,
    origem: row.origem ?? "pdf",
    texto_manual: row.texto_manual ?? null,
  };
}

/**
 * Registra a proposta e dispara a extração do escopo. Cobre dois casos:
 * - origem "pdf": arquivo já enviado ao storage, extração lê o PDF.
 * - origem "manual": sem arquivo — o analista descreveu o escopo em texto
 *   livre (visita solicitada antes de existir proposta comercial) e a mesma
 *   IA de extração estrutura os campos a partir desse texto.
 */
export const registrarProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => RegistrarInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("propostas_comerciais")
      .insert({
        caso_id: data.casoId,
        origem: data.origem,
        arquivo_nome: data.arquivoNome ?? null,
        arquivo_path: data.arquivoPath ?? null,
        tamanho_bytes: data.tamanhoBytes ?? null,
        texto_manual: data.textoManual ?? null,
        status: "processando",
        criado_por: userId,
      } as any)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    const { registrarEvento } = await import("@/lib/eventos.server");
    await registrarEvento({
      casoId: data.casoId,
      tipo: "proposta_anexada" as any,
      atorId: userId,
      metadata:
        data.origem === "manual"
          ? { origem: "manual" }
          : { arquivo: data.arquivoNome },
    });

    if (data.escopo && Object.keys(data.escopo).length) {
      const { aplicarEscopoProposta } = await import("@/lib/proposta/processar.server");
      const atualizado = await aplicarEscopoProposta(supabase, row.id, data.escopo, userId);
      return normalizarProposta(atualizado);
    }

    const { processarProposta } = await import("@/lib/proposta/processar.server");
    const atualizado = await processarProposta(supabase, row.id, userId);
    return normalizarProposta(atualizado);
  });

/** Carrega a proposta do mapeamento (a mais recente) + divergências salvas. */
export const carregarProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => CasoInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("propostas_comerciais")
      .select("*")
      .eq("caso_id", data.casoId)
      .order("criado_em", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);

    // sem proposta anexada não existe comparação: qualquer resultado salvo é stale
    if (!rows?.length) {
      await context.supabase
        .from("casos")
        .update({ divergencias_proposta: {} as any })
        .eq("id", data.casoId);
      return { proposta: null, comparacao: null as ResultadoComparacao | null };
    }

    const { data: caso } = await context.supabase
      .from("casos")
      .select("divergencias_proposta")
      .eq("id", data.casoId)
      .maybeSingle();

    let salvo = (caso as any)?.divergencias_proposta ?? null;
    if (!salvo || !Object.keys(salvo).length) {
      // sem comparação persistida (ou limpa por mudança de regra): recalcula
      const { compararCasoProposta } = await import("@/lib/proposta/processar.server");
      const r = await compararCasoProposta(context.supabase, data.casoId, context.userId);
      salvo = r.comparacao;
    }
    return {
      proposta: normalizarProposta(rows[0]),
      comparacao: (salvo && Object.keys(salvo).length
        ? salvo
        : null) as ResultadoComparacao | null,
    };

  });


/** URL assinada para baixar/visualizar o PDF da proposta. */
export const urlProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ path: z.string().min(1) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase.storage
      .from("propostas")
      .createSignedUrl(data.path, 60 * 30);
    if (error) throw new Error(error.message);
    return { url: signed?.signedUrl ?? null };
  });

/** Reprocessa a extração do PDF já anexado. */
export const reextrairProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ propostaId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { processarProposta } = await import("@/lib/proposta/processar.server");
    const row = await processarProposta(context.supabase, data.propostaId, context.userId);
    return normalizarProposta(row);
  });

/** Edição manual dos campos extraídos. */
export const salvarEscopoProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ propostaId: z.string().uuid(), escopo: z.record(z.string(), z.any()) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("propostas_comerciais")
      .update({ escopo: data.escopo as any, status: "pronto", erro_mensagem: null } as any)
      .eq("id", data.propostaId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return normalizarProposta(row);
  });

/** Recalcula a comparação proposta x formulário. */
export const compararProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => CasoInput.parse(i))
  .handler(async ({ data, context }) => {
    const { compararCasoProposta } = await import("@/lib/proposta/processar.server");
    return await compararCasoProposta(context.supabase, data.casoId, context.userId);
  });

/** Remove a proposta anexada. */
export const removerProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ propostaId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("propostas_comerciais")
      .select("arquivo_path, caso_id")
      .eq("id", data.propostaId)
      .maybeSingle();
    if (row?.arquivo_path) {
      await context.supabase.storage.from("propostas").remove([row.arquivo_path]);
    }
    const { error } = await context.supabase
      .from("propostas_comerciais")
      .delete()
      .eq("id", data.propostaId);
    if (error) throw new Error(error.message);

    // removida a última proposta do caso: as divergências salvas ficam stale
    if (row?.caso_id) {
      const { compararCasoProposta } = await import("@/lib/proposta/processar.server");
      await compararCasoProposta(context.supabase, row.caso_id, context.userId);
    }
    return { ok: true };
  });


/**
 * Pré-análise do PDF ANTES de concluir o agendamento: lê o escopo preliminar
 * de um arquivo já enviado ao storage, sem criar registro de proposta.
 */
export const analisarPropostaPrevia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ arquivoPath: z.string().min(1).max(500) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: file, error } = await context.supabase.storage
      .from("propostas")
      .download(data.arquivoPath);
    if (error || !file) throw new Error(error?.message ?? "Não foi possível ler o arquivo.");

    const bytes = new Uint8Array(await file.arrayBuffer());
    const { extrairTextoPdf, extrairEscopoProposta } = await import("@/lib/proposta/extrair.server");
    const texto = await extrairTextoPdf(bytes);
    if (!texto || texto.length < 40) {
      throw new Error(
        "Não foi possível ler texto do PDF (provavelmente é um documento escaneado). Informe o escopo manualmente.",
      );
    }
    const escopo = await extrairEscopoProposta(texto);
    return { escopo };
  });

/**
 * Pré-análise do escopo descrito em texto livre pelo analista, para casos em
 * que ainda não existe proposta comercial (visita solicitada antes da
 * proposta). Usa a mesma IA de extração da proposta em PDF.
 */
export const analisarEscopoManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ texto: z.string().min(10).max(20000) }).parse(i))
  .handler(async ({ data }) => {
    const { extrairEscopoProposta } = await import("@/lib/proposta/extrair.server");
    const escopo = await extrairEscopoProposta(data.texto);
    return { escopo };
  });
