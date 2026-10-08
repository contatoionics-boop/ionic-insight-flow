import { montarBlocosEAnalise } from "@/lib/laudo/template";
import type { MaterialCatalogo } from "@/lib/laudo/regras";
import type { LaudoConteudo, VariaveisLaudo } from "@/lib/laudo/tipos";

type LinhaResposta = {
  perguntaId: string;
  entidadeId: string | null;
  entidadeRotulo: string | null;
  chave_laudo: string | null;
  pergunta: string;
  valor: string | null;
};

export type InstanciaAmbigua = {
  pergunta: string;
  chave_laudo: string | null;
  valores: { entidade: string; valor: string }[];
};

const norm = (v: string | null) => (v ?? "").trim().toLowerCase();

/**
 * Perguntas repetidas por entidade (Bomba 01, Bomba 02...) não têm um único valor
 * para o laudo. Só alimentam a variável quando não há ambiguidade (uma única
 * resposta, ou todas iguais). Valores diferentes NÃO são resolvidos escolhendo a
 * primeira: a variável fica sem preenchimento e o conflito é registrado. Os dados
 * continuam intactos em respostas_agente.
 */
export function resolverInstancias(linhas: LinhaResposta[]) {
  const gerais = linhas.filter((l) => !l.entidadeId);
  const porPergunta = new Map<string, LinhaResposta[]>();
  for (const l of linhas) {
    if (!l.entidadeId) continue;
    const arr = porPergunta.get(l.perguntaId) ?? [];
    arr.push(l);
    porPergunta.set(l.perguntaId, arr);
  }
  const mantidas: LinhaResposta[] = [...gerais];
  const ambiguas: InstanciaAmbigua[] = [];
  for (const grupo of porPergunta.values()) {
    const comValor = grupo.filter((l) => norm(l.valor) !== "");
    const distintos = new Set(comValor.map((l) => norm(l.valor)));
    if (distintos.size <= 1) {
      mantidas.push(...(comValor.length ? [comValor[0]] : grupo.slice(0, 1)));
    } else {
      ambiguas.push({
        pergunta: grupo[0].pergunta,
        chave_laudo: grupo[0].chave_laudo,
        valores: comValor.map((l) => ({ entidade: l.entidadeRotulo ?? "—", valor: l.valor ?? "" })),
      });
    }
  }
  return {
    respostas: mantidas.map(({ chave_laudo, pergunta, valor }) => ({ chave_laudo, pergunta, valor })),
    ambiguas,
  };
}

export async function carregarContextoLaudo(supabase: any, casoId: string) {
  const { data: caso, error } = await supabase
    .from("casos")
    .select(
      "id, codigo, agendado_em, formulario_id, laudo_variaveis, laudo_conteudo, laudo_alertas, laudo_analise, modalidade, nivel, tipo_solicitacao, agente_nome_manual, agente:profiles!agente_id(nome, email), unidade:unidades(nome, codigo_ionics, matriz:matrizes(nome, empresa:empresas(nome, codigo_ionics)))",
    )
    .eq("id", casoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!caso) throw new Error("Mapeamento não encontrado.");

  const { data: respostas } = await (supabase as any)
    .from("respostas_agente")
    .select(
      "pergunta_id, entidade_id, valor_texto, transcricao, tipo, pergunta:perguntas(texto, chave_laudo, tipo), entidade:escopo_entidades(rotulo)",
    )
    .eq("caso_id", casoId)
    // respostas gerais primeiro (entidade_key nulo): o laudo continua singular e determinístico
    .order("entidade_key" as any, { ascending: true });

  const { data: materiais } = await supabase
    .from("catalogo_materiais")
    .select("id, codigo, descricao, aplicacao, unidade, quantidade_padrao, regra, ativo, ordem")
    .eq("ativo", true)
    .order("ordem", { ascending: true });

  const { valorDaResposta } = await import("@/lib/laudo/respostas");

  const linhas = (respostas ?? []).map((r: any) => ({
    perguntaId: r.pergunta_id as string,
    entidadeId: (r.entidade_id ?? null) as string | null,
    entidadeRotulo: (r.entidade?.rotulo ?? null) as string | null,
    chave_laudo: r.pergunta?.chave_laudo ?? null,
    pergunta: r.pergunta?.texto ?? "",
    valor: valorDaResposta({
      tipo: r.pergunta?.tipo ?? r.tipo ?? null,
      valor_texto: r.valor_texto,
      transcricao: r.transcricao,
    }),
  }));
  const { respostas: respostasLaudo, ambiguas } = resolverInstancias(linhas);

  return {
    caso,
    respostas: respostasLaudo,
    instanciasAmbiguas: ambiguas,
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
  const { caso, respostas, materiais, instanciasAmbiguas } = await carregarContextoLaudo(supabase, casoId);

  const anteriores = (caso.laudo_variaveis ?? {}) as VariaveisLaudo;
  const manuais: VariaveisLaudo = Object.fromEntries(
    Object.entries(anteriores).filter(([, v]) => v?.origem === "manual" && v?.valor),
  );

  // camadas complementares, em ordem de prioridade:
  // identidade do cadastro > proposta comercial > demais dados do cadastro
  const { variaveisIdentidadeCadastro, variaveisComplementaresCadastro } = await import(
    "@/lib/laudo/cadastro"
  );
  const camadas: VariaveisLaudo[] = [variaveisIdentidadeCadastro(caso)];
  let escopoProposta: any = null;
  try {
    const { data: props } = await supabase
      .from("propostas_comerciais")
      .select("escopo, status")
      .eq("caso_id", casoId)
      .eq("status", "pronto")
      .order("criado_em", { ascending: false })
      .limit(1);
    const escopo = props?.[0]?.escopo;
    escopoProposta = escopo ?? null;
    if (escopo) {
      const { variaveisDaProposta } = await import("@/lib/proposta/para-laudo");
      camadas.push(variaveisDaProposta(escopo));
    }
  } catch {
    // sem proposta: segue sem essa camada
  }
  camadas.push(variaveisComplementaresCadastro(caso));

  const variaveis = await extrairVariaveis(respostas, manuais, camadas);

  const meta = metaDoCasoLaudo(caso);
  const analiseSalva = (caso.laudo_analise ?? {}) as { descartados?: string[] };
  const descartados = analiseSalva.descartados ?? [];
  const { produtosDaProposta } = await import("@/lib/laudo/produtos-proposta");
  const produtosProposta = produtosDaProposta(escopoProposta);

  const { blocos, achados } = montarBlocosEAnalise({
    achadosDescartados: descartados,
    produtosProposta,
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

  // preserva as edições do especialista: a automação só atualiza o que não foi tocado
  const { mesclarDocumento } = await import("@/lib/laudo/mesclar");
  const salvos = ((caso.laudo_conteudo as any)?.blocos ?? []) as any[];
  const mescla = mesclarDocumento(salvos, blocos);

  const conteudo: LaudoConteudo = {
    gerado_em: new Date().toISOString(),
    editado_em: (caso.laudo_conteudo as any)?.editado_em ?? null,
    blocos: mescla.blocos,
  };
  const { error } = await supabase
    .from("casos")
    .update({
      laudo_variaveis: variaveis as any,
      laudo_conteudo: conteudo as any,
      laudo_analise: {
        achados,
        descartados,
        analisado_em: new Date().toISOString(),
        // respostas por entidade com valores diferentes: não entram no laudo (decisão manual)
        instancias_ambiguas: instanciasAmbiguas,
      } as any,
    })
    .eq("id", casoId);
  if (error) throw new Error(error.message);


  // Comparação proposta comercial x mapeamento (best-effort).
  try {
    const { compararCasoProposta } = await import("@/lib/proposta/processar.server");
    await compararCasoProposta(supabase, casoId, null);
  } catch {
    // sem proposta anexada ou falha na comparação: laudo segue normalmente
  }

  return {
    caso,
    variaveis,
    conteudo,
    blocos: mescla.blocos,
    conflitos: mescla.conflitos,
    achados,
    descartados,
  };
}
