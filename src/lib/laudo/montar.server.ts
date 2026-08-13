import { montarBlocos } from "@/lib/laudo/template";
import type { MaterialCatalogo } from "@/lib/laudo/regras";
import type { LaudoConteudo, VariaveisLaudo } from "@/lib/laudo/tipos";

export async function carregarContextoLaudo(supabase: any, casoId: string) {
  const { data: caso, error } = await supabase
    .from("casos")
    .select(
      "id, codigo, agendado_em, formulario_id, laudo_variaveis, laudo_conteudo, laudo_alertas, modalidade, nivel, tipo_solicitacao, agente_nome_manual, agente:profiles!agente_id(nome, email), unidade:unidades(nome, codigo_ionics, matriz:matrizes(nome, empresa:empresas(nome, codigo_ionics)))",
    )
    .eq("id", casoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!caso) throw new Error("Mapeamento não encontrado.");

  const { data: respostas } = await supabase
    .from("respostas_agente")
    .select("valor_texto, transcricao, pergunta:perguntas(texto, chave_laudo)")
    .eq("caso_id", casoId);

  const { data: materiais } = await supabase
    .from("catalogo_materiais")
    .select("id, codigo, descricao, aplicacao, unidade, quantidade_padrao, regra, ativo, ordem")
    .eq("ativo", true)
    .order("ordem", { ascending: true });

  return {
    caso,
    respostas: (respostas ?? []).map((r: any) => ({
      chave_laudo: r.pergunta?.chave_laudo ?? null,
      pergunta: r.pergunta?.texto ?? "",
      valor: r.valor_texto ?? r.transcricao ?? null,
    })),
    materiais: (materiais ?? []) as unknown as MaterialCatalogo[],
  };
}

export function metaDoCasoLaudo(caso: any) {
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

/**
 * Extrai variáveis (formulário + IA), monta os blocos do laudo e persiste no caso.
 * Reutilizado pela geração manual (aba Laudo) e pela finalização do mapeamento.
 */
export async function montarESalvarLaudo(supabase: any, casoId: string) {
  const { extrairVariaveis } = await import("@/lib/laudo/extrair.server");
  const { caso, respostas, materiais } = await carregarContextoLaudo(supabase, casoId);

  const anteriores = (caso.laudo_variaveis ?? {}) as VariaveisLaudo;
  const manuais: VariaveisLaudo = Object.fromEntries(
    Object.entries(anteriores).filter(([, v]) => v?.origem === "manual" && v?.valor),
  );

  // camadas complementares: proposta comercial > cadastro do agendamento
  const camadas: VariaveisLaudo[] = [];
  try {
    const { data: props } = await supabase
      .from("propostas_comerciais")
      .select("escopo, status")
      .eq("caso_id", casoId)
      .eq("status", "pronto")
      .order("criado_em", { ascending: false })
      .limit(1);
    const escopo = props?.[0]?.escopo;
    if (escopo) {
      const { variaveisDaProposta } = await import("@/lib/proposta/para-laudo");
      camadas.push(variaveisDaProposta(escopo));
    }
  } catch {
    // sem proposta: segue sem essa camada
  }
  const { variaveisDoCadastro } = await import("@/lib/laudo/cadastro");
  camadas.push(variaveisDoCadastro(caso));

  const variaveis = await extrairVariaveis(respostas, manuais, camadas);
  const meta = metaDoCasoLaudo(caso);
  const blocos = montarBlocos({
    variaveis,
    materiais,
    cabecalho: {
      cliente: meta.cliente,
      unidade: meta.unidade,
      data: meta.data,
      agente: meta.agente,
      especialista: "",
      modalidade: caso.modalidade ?? null,
    },
  });

  const conteudo: LaudoConteudo = { gerado_em: new Date().toISOString(), blocos };
  const { error } = await supabase
    .from("casos")
    .update({ laudo_variaveis: variaveis as any, laudo_conteudo: conteudo as any })
    .eq("id", casoId);
  if (error) throw new Error(error.message);

  // Comparação proposta comercial x mapeamento (best-effort).
  try {
    const { compararCasoProposta } = await import("@/lib/proposta/processar.server");
    await compararCasoProposta(supabase, casoId, null);
  } catch {
    // sem proposta anexada ou falha na comparação: laudo segue normalmente
  }

  return { caso, variaveis, conteudo, blocos };
}
