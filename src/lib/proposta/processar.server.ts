// Server-only: baixa o PDF, extrai o escopo e compara com o mapeamento.
import { compararPropostaCampo } from "@/lib/proposta/comparar";
import { normalizarEscopo, type ResultadoComparacao } from "@/lib/proposta/tipos";
import type { VariaveisLaudo } from "@/lib/laudo/tipos";

/** Extrai o escopo do PDF (ou reinterpreta o texto manual) já anexado e persiste o resultado. */
export async function processarProposta(supabase: any, propostaId: string, userId?: string | null) {
  const { data: row, error } = await supabase
    .from("propostas_comerciais")
    .select("id, caso_id, arquivo_path, escopo, origem, texto_manual")
    .eq("id", propostaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Proposta não encontrada.");

  await supabase
    .from("propostas_comerciais")
    .update({ status: "processando", erro_mensagem: null })
    .eq("id", propostaId);

  try {
    const { extrairTextoPdf, extrairEscopoProposta } = await import("@/lib/proposta/extrair.server");

    let texto: string;
    if (row.origem === "manual") {
      texto = (row.texto_manual ?? "").trim();
      if (!texto) {
        throw new Error("Não há texto de escopo manual para reinterpretar.");
      }
    } else {
      const { data: file, error: dErr } = await supabase.storage
        .from("propostas")
        .download(row.arquivo_path);
      if (dErr || !file) throw new Error(dErr?.message ?? "Não foi possível ler o arquivo.");

      const bytes = new Uint8Array(await file.arrayBuffer());
      texto = await extrairTextoPdf(bytes);
      if (!texto || texto.length < 40) {
        throw new Error(
          "Não foi possível ler texto do PDF (provavelmente é um documento escaneado). Preencha o escopo manualmente.",
        );
      }
    }

    const extraido = await extrairEscopoProposta(texto);
    // correções manuais anteriores sempre vencem a reextração
    const anterior = normalizarEscopo((row as any).escopo);
    const escopo: any = { ...extraido };
    for (const [chave, campo] of Object.entries(anterior)) {
      if ((campo as any)?.origem === "manual" && (campo as any)?.valor !== null) {
        escopo[chave] = campo;
      }
    }
    const { data: atualizado, error: uErr } = await supabase
      .from("propostas_comerciais")
      .update({
        status: "pronto",
        erro_mensagem: null,
        escopo: escopo as any,
        texto_extraido: texto.slice(0, 200000),
      })
      .eq("id", propostaId)
      .select("*")
      .single();
    if (uErr) throw new Error(uErr.message);

    const { registrarEvento } = await import("@/lib/eventos.server");
    await registrarEvento({
      casoId: row.caso_id,
      tipo: "proposta_extraida" as any,
      atorId: userId ?? null,
      metadata: { nivel: escopo.nivel_automacao?.valor, qtd_bicos: escopo.qtd_bicos?.valor },
    });

    // remonta o laudo para incorporar os dados vindos da proposta
    try {
      const { montarESalvarLaudo } = await import("@/lib/laudo/montar.server");
      await montarESalvarLaudo(supabase, row.caso_id);
    } catch {
      // remontagem best-effort (ex.: formulário ainda não respondido)
    }

    // já tenta comparar com o que existe do formulário
    try {
      await compararCasoProposta(supabase, row.caso_id, userId ?? null);
    } catch {
      // comparação é best-effort aqui
    }

    return atualizado;
  } catch (e: any) {
    const { data: comErro } = await supabase
      .from("propostas_comerciais")
      .update({ status: "erro", erro_mensagem: String(e?.message ?? e).slice(0, 500) })
      .eq("id", propostaId)
      .select("*")
      .single();
    return comErro;
  }
}

/**
 * Persiste um escopo já analisado/corrigido (ex.: revisado no agendamento) e
 * dispara a remontagem do laudo + comparação, sem reextrair o PDF.
 */
export async function aplicarEscopoProposta(
  supabase: any,
  propostaId: string,
  escopoBruto: any,
  userId?: string | null,
) {
  const escopo = normalizarEscopo(escopoBruto);
  const { data: row, error } = await supabase
    .from("propostas_comerciais")
    .update({ status: "pronto", erro_mensagem: null, escopo: escopo as any })
    .eq("id", propostaId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  try {
    const { montarESalvarLaudo } = await import("@/lib/laudo/montar.server");
    await montarESalvarLaudo(supabase, row.caso_id);
  } catch {
    // formulário ainda não respondido: remontagem é best-effort
  }
  try {
    await compararCasoProposta(supabase, row.caso_id, userId ?? null);
  } catch {
    // comparação best-effort
  }
  return row;
}

/** Compara a proposta mais recente do caso com as variáveis do laudo e persiste. */
export async function compararCasoProposta(
  supabase: any,
  casoId: string,
  userId?: string | null,
): Promise<{ comparacao: ResultadoComparacao | null }> {
  const { data: props } = await supabase
    .from("propostas_comerciais")
    .select("escopo, status")
    .eq("caso_id", casoId)
    .order("criado_em", { ascending: false })
    .limit(1);
  const proposta = props?.[0];
  if (!proposta) {
    // sem proposta não há comparação: limpa qualquer resultado stale do caso
    await supabase.from("casos").update({ divergencias_proposta: {} as any }).eq("id", casoId);
    return { comparacao: null };
  }


  const { data: caso } = await supabase
    .from("casos")
    .select("laudo_variaveis")
    .eq("id", casoId)
    .maybeSingle();

  const escopo = normalizarEscopo(proposta.escopo);
  const variaveis = (caso?.laudo_variaveis ?? {}) as VariaveisLaudo;
  const comparacao = compararPropostaCampo(escopo, variaveis);

  await supabase
    .from("casos")
    .update({ divergencias_proposta: comparacao as any })
    .eq("id", casoId);

  const { registrarEvento } = await import("@/lib/eventos.server");
  await registrarEvento({
    casoId,
    tipo: "divergencias_calculadas" as any,
    atorId: userId ?? null,
    metadata: {
      total: comparacao.divergencias.length,
      altas: comparacao.divergencias.filter((d) => d.severidade === "alta").length,
    },
  });

  return { comparacao };
}
