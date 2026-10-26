// Estrutura física sugerida a partir do escopo lido da proposta (client-safe, função pura).
import type { EscopoProposta } from "@/lib/proposta/tipos";
import { LIMITES, arvoreVazia, type ArvoreEscopo, type ConfigEscopo } from "./tipos";

const num = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));
const qtd = (v: unknown, max: number) => Math.min(num(v), max);

/**
 * Preenche só as quantidades de postos, comboios, tanques com lubrificante e sondas lidas da proposta.
 * Ilhas, bombas e bicos ficam para o usuário (um posto nasce sem ilhas, como no "+" da estrutura).
 */
export function estruturaDoEscopo(e: EscopoProposta | null | undefined, config: ConfigEscopo = {}): ArvoreEscopo {
  const comboios = num(e?.qtd_comboios?.valor) || (e?.tem_comboio?.valor ? 1 : 0);
  // "pista / posto fixo" sem quantidade informada: considera 1 posto
  const postos = num(e?.qtd_postos?.valor) || (e?.tem_pista?.valor === true ? 1 : 0);

  return {
    ...arvoreVazia(),
    config,
    postos: Array.from({ length: Math.min(postos, LIMITES.postos) }, () => ({ ilhas: [] })),
    comboios: Array.from({ length: Math.min(comboios, LIMITES.comboios) }, () => ({ tanques: 0, bicos: 0 })),
    tanquesLubrificante: Array.from({ length: qtd(e?.qtd_tanques_lubrificante?.valor, LIMITES.tanques) }, () => ({})),
    sondas: Array.from({ length: qtd(e?.qtd_sondas?.valor, LIMITES.sondas) }, () => ({})),
  };
}

/** true quando a estrutura ainda não tem nada definido (nada a perder ao preencher sozinho). */
export function estruturaEhVazia(a: ArvoreEscopo): boolean {
  return !a.postos.length && !a.comboios.length && !a.tanquesLubrificante.length && !a.sondas.length && !a.frota.ativo;
}
