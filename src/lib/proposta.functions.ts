import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PropostaResumo, ResultadoComparacao } from "@/lib/proposta/tipos";
import { normalizarEscopo } from "@/lib/proposta/tipos";

const CasoInput = z.object({ casoId: z.string().uuid() });

const RegistrarInput = z.object({
  casoId: z.string().uuid(),
  arquivoNome: z.string().min(1).max(300),
  arquivoPath: z.string().min(1).max(500),
  tamanhoBytes: z.number().int().nonnegative().optional().nullable(),
  /** escopo já analisado/corrigido no agendamento — evita reextrair */
  escopo: z.record(z.string(), z.any()).optional().nullable(),
});

function normalizarProposta(row: any): PropostaResumo {
  return {
    id: row.id,
    caso_id: row.caso_id,
    arquivo_nome: row.arquivo_nome,
    arquivo_path: row.arquivo_path,
    tamanho_bytes: row.tamanho_bytes ?? null,
    status: row.status,
    erro_mensagem: row.erro_mensagem ?? null,
    escopo: normalizarEscopo(row.escopo),
    criado_em: row.criado_em,
  };
}

/** Registra a proposta já enviada ao storage e dispara a extração do escopo. */
export const registrarProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => RegistrarInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("propostas_comerciais")
      .insert({
        caso_id: data.casoId,
        arquivo_nome: data.arquivoNome,
        arquivo_path: data.arquivoPath,
        tamanho_bytes: data.tamanhoBytes ?? null,
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
      metadata: { arquivo: data.arquivoNome },
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

    const { data: caso } = await context.supabase
      .from("casos")
      .select("divergencias_proposta")
      .eq("id", data.casoId)
      .maybeSingle();

    return {
      proposta: rows?.length ? normalizarProposta(rows[0]) : null,
      comparacao: ((caso as any)?.divergencias_proposta ?? null) as ResultadoComparacao | null,
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
      .select("arquivo_path")
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
