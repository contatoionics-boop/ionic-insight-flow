// Contexto de composição do Resultado de Mapeamento (client-safe, função pura).
//
// Junta o que o ESCOPO define (quais equipamentos existem) com o que o MAPEAMENTO informou
// (respostas por unidade, identificadas por `chave_laudo`). É a base dos blocos repetíveis
// (uma bomba = um bloco, um comboio = um bloco). Só lê chaves semânticas estáveis: nunca o texto
// visível das perguntas.

import type { ArvoreEscopo, EntidadeEscopo } from "@/lib/escopo/tipos";
import { ehTipoFixo, totalRfid } from "@/lib/escopo/tipos";
import { pluralDoTipo, rotuloDoTipo, type TipoCatalogo } from "@/lib/escopo/catalogo-tipos";

/** `pergunta`: texto da pergunta (usado nos itens de tipos novos, que não têm chave do laudo). */
export type RespostaDeEntidade = { entidadeId: string | null; chave: string | null; valor: string | null; pergunta?: string | null };
export type Atributos = Record<string, string>;

export type BicoCtx = { id: string; rotulo: string; ordem: number; atributos: Atributos };

export type BombaCtx = {
  id: string;
  rotulo: string;
  posto: string | null;
  ilha: string | null;
  atributos: Atributos;
  bicos: BicoCtx[];
  /** quantidade de bicos = entidades `bico` filhas (não vem de pergunta) */
  qtdBicos: number;
};

export type ComboioCtx = {
  id: string;
  rotulo: string;
  /** identificação opcional dada no Escopo (ex.: "Frota 400") */
  nome?: string | null;
  /** "Comboio 400": a identificação respondida pelo agente; sem resposta, a do Escopo; sem ela, o rótulo do Escopo */
  identificacao: string;
  atributos: Atributos;
  bicos: BicoCtx[];
  qtdBicos: number;
};

/** Um item de um tipo criado em Configurações › Tipos de item (ex.: "Prédio 01") com o que o agente respondeu. */
export type ItemExtraCtx = { id: string; rotulo: string; nome: string | null; respostas: { pergunta: string; valor: string }[] };
export type GrupoExtraCtx = { tipo: string; rotulo: string; plural: string; itens: ItemExtraCtx[] };

export type EscopoCtx = {
  solucao: string | null;
  comunicacao: string | null;
  /** conexão de dados do posto e do comboio (cada um pode usar um modelo); sem a específica vale `comunicacao` */
  comunicacaoPosto: string | null;
  comunicacaoComboio: string | null;
  temPista: boolean;
  temComboio: boolean;
  qtdPostos: number;
  qtdBombas: number;
  qtdComboios: number;
  qtdTanquesLubrificante: number;
  qtdSondas: number;
  rfid: { ativo: boolean; quantidade: number; tecnologias: string[] };
  tx: { ativo: boolean; quantidade: number };
  frota: { ativa: boolean; tipos: { modelo: string; quantidade: number }[]; totalDiv: number };
};

export type ContextoLaudo = {
  escopo: EscopoCtx;
  bombas: BombaCtx[];
  comboios: ComboioCtx[];
  /** itens dos tipos novos (Prédio, Produto…), um grupo por tipo; ausente em contextos antigos */
  extras?: GrupoExtraCtx[];
  /** respostas gerais (sem entidade) pela chave semântica */
  gerais: Atributos;
};

const vazio = (v: string | null | undefined) => !(v ?? "").trim();

/** Chave → valor por entidade; havendo mais de uma resposta para a mesma chave, vale a última preenchida. */
function atributosPorEntidade(respostas: RespostaDeEntidade[]): { gerais: Atributos; porEntidade: Map<string, Atributos> } {
  const gerais: Atributos = {};
  const porEntidade = new Map<string, Atributos>();
  for (const r of respostas) {
    if (!r.chave || vazio(r.valor)) continue;
    const alvo = r.entidadeId ? (porEntidade.get(r.entidadeId) ?? porEntidade.set(r.entidadeId, {}).get(r.entidadeId)!) : gerais;
    alvo[r.chave] = String(r.valor).trim();
  }
  return { gerais, porEntidade };
}

const porOrdem = (a: { ordem: number; rotulo: string }, b: { ordem: number; rotulo: string }) =>
  a.ordem - b.ordem || a.rotulo.localeCompare(b.rotulo, "pt-BR", { numeric: true });

export function montarContextoLaudo(entrada: {
  entidades: EntidadeEscopo[];
  arvore: ArvoreEscopo;
  respostas: RespostaDeEntidade[];
  /** nomes dos tipos novos; sem ele vale a chave do tipo */
  catalogo?: TipoCatalogo[] | null;
}): ContextoLaudo {
  const ativas = entrada.entidades.filter((e) => e.ativo !== false);
  const porId = new Map(ativas.map((e) => [e.id, e]));
  const { gerais, porEntidade } = atributosPorEntidade(entrada.respostas);
  const atrs = (id: string) => porEntidade.get(id) ?? {};

  const filhos = (paiId: string, tipo: EntidadeEscopo["tipo"]) =>
    ativas.filter((e) => e.parent_id === paiId && e.tipo === tipo).sort(porOrdem);
  const bicosDe = (paiId: string): BicoCtx[] =>
    filhos(paiId, "bico").map((b) => ({ id: b.id, rotulo: b.rotulo, ordem: b.ordem, atributos: atrs(b.id) }));

  // ordem da pista: posto › ilha › bomba
  const ordemCaminho = (e: EntidadeEscopo): number[] => {
    const cadeia: EntidadeEscopo[] = [];
    for (let atual: EntidadeEscopo | undefined = e; atual; atual = atual.parent_id ? porId.get(atual.parent_id) : undefined) cadeia.unshift(atual);
    return cadeia.map((c) => c.ordem);
  };
  const bombas: BombaCtx[] = ativas
    .filter((e) => e.tipo === "bomba")
    .sort((a, b) => {
      const ca = ordemCaminho(a);
      const cb = ordemCaminho(b);
      for (let i = 0; i < Math.max(ca.length, cb.length); i++) if ((ca[i] ?? -1) !== (cb[i] ?? -1)) return (ca[i] ?? -1) - (cb[i] ?? -1);
      return 0;
    })
    .map((b) => {
      const ilha = b.parent_id ? porId.get(b.parent_id) : undefined;
      const posto = ilha?.parent_id ? porId.get(ilha.parent_id) : undefined;
      const bicos = bicosDe(b.id);
      return { id: b.id, rotulo: b.rotulo, posto: posto?.rotulo ?? null, ilha: ilha?.rotulo ?? null, atributos: atrs(b.id), bicos, qtdBicos: bicos.length };
    });

  const comboios: ComboioCtx[] = ativas
    .filter((e) => e.tipo === "comboio")
    .sort(porOrdem)
    .map((c) => {
      const atributos = atrs(c.id);
      const bicos = bicosDe(c.id);
      const nome = c.dados?.nome?.trim() || null;
      return { id: c.id, rotulo: c.rotulo, nome, identificacao: atributos.identificacao_comboio || nome || c.rotulo, atributos, bicos, qtdBicos: bicos.length };
    });

  // tipos novos: um grupo por tipo, com as respostas (pergunta → valor) de cada item
  const extras: GrupoExtraCtx[] = [];
  for (const tipo of [...new Set(ativas.filter((e) => e.parent_id === null && !ehTipoFixo(e.tipo)).map((e) => e.tipo))]) {
    const itens = ativas
      .filter((e) => e.parent_id === null && e.tipo === tipo)
      .sort(porOrdem)
      .map((e): ItemExtraCtx => {
        const respostas: { pergunta: string; valor: string }[] = [];
        for (const r of entrada.respostas) {
          if (r.entidadeId !== e.id || vazio(r.valor) || vazio(r.pergunta)) continue;
          const pergunta = String(r.pergunta).trim();
          const valor = String(r.valor).trim();
          const i = respostas.findIndex((x) => x.pergunta === pergunta);
          if (i >= 0) respostas[i] = { pergunta, valor };
          else respostas.push({ pergunta, valor });
        }
        return { id: e.id, rotulo: e.rotulo, nome: e.dados?.nome?.trim() || null, respostas };
      });
    extras.push({ tipo, rotulo: rotuloDoTipo(entrada.catalogo, tipo), plural: pluralDoTipo(entrada.catalogo, tipo), itens });
  }

  const cfg = entrada.arvore.config ?? {};
  const frotaItens = entrada.arvore.frota?.itens ?? [];
  const rfidItens = cfg.rfid?.itens ?? [];
  const txItens = cfg.tx?.itens ?? [];
  const qtdPostos = entrada.arvore.postos.length || ativas.filter((e) => e.tipo === "posto").length;
  const escopo: EscopoCtx = {
    solucao: cfg.solucao ? String(cfg.solucao) : null,
    comunicacao: cfg.comunicacao ?? null,
    comunicacaoPosto: cfg.comunicacao_posto ?? null,
    comunicacaoComboio: cfg.comunicacao_comboio ?? null,
    temPista: qtdPostos > 0 || bombas.length > 0,
    temComboio: comboios.length > 0,
    qtdPostos,
    qtdBombas: bombas.length,
    qtdComboios: comboios.length,
    qtdTanquesLubrificante: entrada.arvore.tanquesLubrificante.length,
    qtdSondas: entrada.arvore.sondas.length,
    rfid: {
      ativo: !!cfg.rfid?.ativo || totalRfid(rfidItens) > 0,
      quantidade: totalRfid(rfidItens),
      tecnologias: [...new Set(rfidItens.map((i) => (i.tecnologia ?? "").trim()).filter(Boolean))],
    },
    tx: { ativo: !!cfg.tx?.ativo || txItens.length > 0, quantidade: txItens.reduce((s, i) => s + (Number(i.quantidade) || 0), 0) },
    frota: {
      ativa: !!entrada.arvore.frota?.ativo || frotaItens.length > 0,
      tipos: frotaItens.map((i) => ({ modelo: i.modelo, quantidade: Number(i.quantidade) || 0 })),
      totalDiv: frotaItens.reduce((s, i) => s + (Number(i.quantidade) || 0), 0),
    },
  };

  return { escopo, bombas, comboios, ...(extras.length ? { extras } : {}), gerais };
}

/** Preenche com o complemento só o que a base não tem (a base nunca é sobrescrita). */
const completar = (base: Atributos, complemento: Atributos): Atributos => ({ ...complemento, ...base });

const maisBicos = (a: BicoCtx[], b: BicoCtx[]) => (b.length > a.length ? b : a);

/**
 * Junta os contextos de mapeamentos da MESMA visita (ex.: formulário da pista e formulário do comboio,
 * cada um em seu caso) num único contexto. O primeiro (`principal`) manda: o dos demais só preenche lacunas.
 * Bombas se unem pelo local (posto/ilha/rótulo); comboios, pela posição (1º com 1º, 2º com 2º).
 */
export function mesclarContextos(principal: ContextoLaudo, outros: ContextoLaudo[]): ContextoLaudo {
  let atual = principal;
  for (const o of outros) atual = mesclarDois(atual, o);
  return atual;
}

function mesclarDois(a: ContextoLaudo, b: ContextoLaudo): ContextoLaudo {
  const chaveBomba = (x: BombaCtx) => `${x.posto ?? ""}|${x.ilha ?? ""}|${x.rotulo}`;
  const doOutro = new Map(b.bombas.map((x) => [chaveBomba(x), x]));
  const bombas: BombaCtx[] = a.bombas.map((x) => {
    const y = doOutro.get(chaveBomba(x));
    if (!y) return x;
    doOutro.delete(chaveBomba(x));
    const bicos = maisBicos(x.bicos, y.bicos);
    return { ...x, atributos: completar(x.atributos, y.atributos), bicos, qtdBicos: bicos.length };
  });
  bombas.push(...doOutro.values());

  const total = Math.max(a.comboios.length, b.comboios.length);
  const comboios: ComboioCtx[] = [];
  for (let i = 0; i < total; i++) {
    const x = a.comboios[i];
    const y = b.comboios[i];
    if (!x || !y) {
      comboios.push((x ?? y)!);
      continue;
    }
    const atributos = completar(x.atributos, y.atributos);
    const bicos = maisBicos(x.bicos, y.bicos);
    const nome = x.nome || y.nome || null;
    comboios.push({ ...x, nome, atributos, bicos, qtdBicos: bicos.length, identificacao: atributos.identificacao_comboio || nome || x.rotulo });
  }

  const ea = a.escopo;
  const eb = b.escopo;
  const escopo: EscopoCtx = {
    ...ea,
    solucao: ea.solucao ?? eb.solucao,
    comunicacao: ea.comunicacao ?? eb.comunicacao,
    comunicacaoPosto: ea.comunicacaoPosto ?? eb.comunicacaoPosto,
    comunicacaoComboio: ea.comunicacaoComboio ?? eb.comunicacaoComboio,
    temPista: ea.temPista || eb.temPista || bombas.length > 0,
    temComboio: ea.temComboio || eb.temComboio || comboios.length > 0,
    qtdPostos: Math.max(ea.qtdPostos, eb.qtdPostos),
    qtdBombas: bombas.length,
    qtdComboios: comboios.length,
    qtdTanquesLubrificante: Math.max(ea.qtdTanquesLubrificante, eb.qtdTanquesLubrificante),
    qtdSondas: Math.max(ea.qtdSondas, eb.qtdSondas),
    rfid: eb.rfid.quantidade > ea.rfid.quantidade ? eb.rfid : ea.rfid,
    tx: eb.tx.quantidade > ea.tx.quantidade ? eb.tx : ea.tx,
    frota: eb.frota.totalDiv > ea.frota.totalDiv ? eb.frota : ea.frota,
  };
  // tipos novos: o principal manda; o outro só acrescenta itens que faltam e respostas não dadas (pela posição)
  const extras: GrupoExtraCtx[] = (a.extras ?? []).map((g) => ({ ...g, itens: g.itens.map((i) => ({ ...i, respostas: [...i.respostas] })) }));
  for (const gb of b.extras ?? []) {
    const ga = extras.find((x) => x.tipo === gb.tipo);
    if (!ga) {
      extras.push(gb);
      continue;
    }
    gb.itens.forEach((ib, i) => {
      const ia = ga.itens[i];
      if (!ia) return void ga.itens.push(ib);
      for (const r of ib.respostas) if (!ia.respostas.some((x) => x.pergunta === r.pergunta)) ia.respostas.push(r);
    });
  }
  return { escopo, bombas, comboios, ...(extras.length ? { extras } : {}), gerais: completar(a.gerais, b.gerais) };
}

/**
 * Variáveis gerais do documento completadas com o que os mapeamentos da mesma visita informaram
 * (`contexto.gerais` já vem mesclado). Só preenche lacunas: o que este caso respondeu ou o
 * especialista editou nunca é trocado.
 */
export function completarVariaveis<V extends { valor: string | null }>(
  variaveis: Record<string, V>,
  contexto: ContextoLaudo | null,
  nova: (chave: string, valor: string) => V,
): Record<string, V> {
  if (!contexto) return variaveis;
  const resultado = { ...variaveis };
  for (const [chave, valor] of Object.entries(contexto.gerais)) {
    if ((resultado[chave]?.valor ?? "").toString().trim()) continue;
    resultado[chave] = nova(chave, valor);
  }
  return resultado;
}
