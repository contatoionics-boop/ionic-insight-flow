// Blocos padrão com condição de aparição ("regras em dados"), client-safe, funções puras.
//
// O especialista cadastra um texto padrão na tela "Blocos padrão" e diz quando ele entra sozinho no
// documento (solução, nível, itens do Escopo). A condição fica na coluna `escopo` (jsonb) do bloco padrão:
//   { automatico: true, solucao: ["ssg_frota"], nivel: ["nivel_2"], exige: ["comboio", "tx"] }
// Condição vazia em um campo = "qualquer". Todos os campos preenchidos precisam ser atendidos.

import type { ContextoLaudo } from "./contexto";
import type { BlocoLaudo } from "./tipos";

export const EXIGENCIAS = ["pista", "comboio", "rfid", "tx", "frota"] as const;
export type Exigencia = (typeof EXIGENCIAS)[number];

export const ROTULO_EXIGENCIA: Record<Exigencia, string> = {
  pista: "Posto / pista",
  comboio: "Comboio",
  rfid: "Cartão RFID",
  tx: "Telemetria TX",
  frota: "DIV / frota",
};
export const SOLUCOES_REGRA = [
  { valor: "ssg_frota", rotulo: "SSGFrota" },
  { valor: "on_premise", rotulo: "On-premise" },
] as const;
export const NIVEIS_REGRA = [
  { valor: "nivel_1", rotulo: "Nível 1" },
  { valor: "nivel_2", rotulo: "Nível 2" },
  { valor: "nivel_3", rotulo: "Nível 3" },
] as const;

export type RegraBlocoPadrao = {
  automatico: boolean;
  solucao: string[];
  nivel: string[];
  exige: Exigencia[];
};

export type BlocoPadraoAuto = { id: string; nome: string; escopo: Record<string, any> | null; blocos: BlocoLaudo[]; ordem?: number };

const lista = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** Lê a regra gravada em `escopo`; qualquer coisa fora do formato vira "sem regra". */
export function lerRegra(escopo: Record<string, any> | null | undefined): RegraBlocoPadrao {
  const e = escopo ?? {};
  return {
    automatico: e.automatico === true,
    solucao: lista(e.solucao),
    nivel: lista(e.nivel),
    exige: lista(e.exige).filter((x): x is Exigencia => (EXIGENCIAS as readonly string[]).includes(x)),
  };
}

/** Grava a regra no formato de `escopo` (campos vazios não são gravados). */
export function regraParaEscopo(r: RegraBlocoPadrao): Record<string, any> {
  if (!r.automatico) return {};
  return {
    automatico: true,
    ...(r.solucao.length ? { solucao: r.solucao } : {}),
    ...(r.nivel.length ? { nivel: r.nivel } : {}),
    ...(r.exige.length ? { exige: r.exige } : {}),
  };
}

/** Resumo legível da regra, para a lista de blocos padrão. */
export function resumoDaRegra(r: RegraBlocoPadrao): string {
  if (!r.automatico) return "Inserção manual";
  const partes: string[] = [];
  if (r.solucao.length) partes.push(r.solucao.map((s) => SOLUCOES_REGRA.find((x) => x.valor === s)?.rotulo ?? s).join(" ou "));
  if (r.nivel.length) partes.push(r.nivel.map((n) => NIVEIS_REGRA.find((x) => x.valor === n)?.rotulo ?? n).join(" ou "));
  if (r.exige.length) partes.push(`com ${r.exige.map((x) => ROTULO_EXIGENCIA[x]).join(" e ")}`);
  return `Automático${partes.length ? `: ${partes.join(" · ")}` : ": em todos os documentos"}`;
}

export type AvaliacaoRegra = { nivel: string | null; contexto: ContextoLaudo | null };

/** A regra é atendida pelo caso? Dado desconhecido nunca satisfaz uma condição (não inclui por engano). */
export function regraAtende(r: RegraBlocoPadrao, a: AvaliacaoRegra): boolean {
  if (!r.automatico) return false;
  const e = a.contexto?.escopo;
  if (r.solucao.length && (!e?.solucao || !r.solucao.includes(e.solucao))) return false;
  if (r.nivel.length && (!a.nivel || !r.nivel.includes(a.nivel))) return false;
  const tem: Record<Exigencia, boolean> = {
    pista: !!e?.temPista,
    comboio: !!e?.temComboio,
    rfid: !!e?.rfid.ativo,
    tx: !!e?.tx.ativo,
    frota: !!e?.frota.ativa,
  };
  return r.exige.every((x) => tem[x]);
}

/**
 * Blocos dos padrões automáticos que se aplicam ao caso. Cada bloco ganha chave estável
 * (`padrao:<id>:<posição>`): a edição do especialista sobrevive ao "Regerar rascunho".
 * O título de seção vira título numerado automaticamente.
 */
export function blocosPadraoAutomaticos(
  padroes: BlocoPadraoAuto[],
  a: AvaliacaoRegra,
  id: (prefixo: string) => string,
): BlocoLaudo[] {
  const saida: BlocoLaudo[] = [];
  const ordenados = [...padroes].sort((x, y) => (x.ordem ?? 0) - (y.ordem ?? 0) || x.nome.localeCompare(y.nome));
  for (const p of ordenados) {
    if (!regraAtende(lerRegra(p.escopo), a)) continue;
    (p.blocos ?? []).forEach((b, i) => {
      const base = { ...b, id: id("bp"), chave: `padrao:${p.id}:${i}`, origem: "dynamic", editavel: true, removivel: true } as any;
      saida.push(b.tipo === "heading" ? ({ ...base, numero: "0", nivel: 2 } as BlocoLaudo) : (base as BlocoLaudo));
    });
  }
  return saida;
}

/** Algum padrão automático aplicável exige este item do Escopo? (ex.: o texto da TX cadastrado substitui o espaço vazio) */
export function padraoCobre(padroes: BlocoPadraoAuto[], a: AvaliacaoRegra, item: Exigencia): boolean {
  return padroes.some((p) => {
    const r = lerRegra(p.escopo);
    return r.exige.includes(item) && regraAtende(r, a) && (p.blocos ?? []).length > 0;
  });
}
