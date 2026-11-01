// Contexto de composição do Resultado de Mapeamento (client-safe, função pura).
//
// Junta o que o ESCOPO define (quais equipamentos existem) com o que o MAPEAMENTO informou
// (respostas por unidade, identificadas por `chave_laudo`). É a base dos blocos repetíveis
// (uma bomba = um bloco, um comboio = um bloco). Só lê chaves semânticas estáveis: nunca o texto
// visível das perguntas.

import type { ArvoreEscopo, EntidadeEscopo } from "@/lib/escopo/tipos";
import { totalRfid } from "@/lib/escopo/tipos";

export type RespostaDeEntidade = { entidadeId: string | null; chave: string | null; valor: string | null };
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
  /** "Comboio 400": a identificação respondida; sem resposta, o rótulo do Escopo */
  identificacao: string;
  atributos: Atributos;
  bicos: BicoCtx[];
  qtdBicos: number;
};

export type EscopoCtx = {
  solucao: string | null;
  comunicacao: string | null;
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
      return { id: c.id, rotulo: c.rotulo, identificacao: atributos.identificacao_comboio || c.rotulo, atributos, bicos, qtdBicos: bicos.length };
    });

  const cfg = entrada.arvore.config ?? {};
  const frotaItens = entrada.arvore.frota?.itens ?? [];
  const rfidItens = cfg.rfid?.itens ?? [];
  const txItens = cfg.tx?.itens ?? [];
  const qtdPostos = entrada.arvore.postos.length || ativas.filter((e) => e.tipo === "posto").length;
  const escopo: EscopoCtx = {
    solucao: cfg.solucao ? String(cfg.solucao) : null,
    comunicacao: cfg.comunicacao ?? null,
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

  return { escopo, bombas, comboios, gerais };
}
