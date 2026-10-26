// Estrutura física sugerida a partir do escopo lido da proposta (client-safe, função pura).
import type { EscopoProposta } from "@/lib/proposta/tipos";
import { LIMITES, arvoreVazia, type ArvoreEscopo, type ConfigEscopo } from "./tipos";

const num = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));
const limitar = (n: number, max: number) => Math.min(Math.max(n, 1), max);

/**
 * Monta postos › ilhas › bombas › bicos e comboios com as quantidades da proposta.
 * - pista: com `qtd_pistas`, cada pista é uma ilha (distribuídas entre os postos);
 * - sem nenhuma informação de pista (escopo só de comboio, ou nada identificado), não cria posto;
 * - bombas e bicos da proposta são totais e se repartem de forma uniforme.
 */
export function estruturaDoEscopo(e: EscopoProposta | null | undefined, config: ConfigEscopo = {}): ArvoreEscopo {
  const comboios = num(e?.qtd_comboios?.valor) || (e?.tem_comboio?.valor ? 1 : 0);
  const pistas = num(e?.qtd_pistas?.valor);
  const bombasTotal = num(e?.qtd_bombas?.valor);
  const bicosTotal = num(e?.qtd_bicos?.valor);
  const postosInformados = num(e?.qtd_postos?.valor);

  const temPista = e?.tem_pista?.valor === true || pistas > 0 || postosInformados > 0 || bombasTotal > 0 || bicosTotal > 0;
  const arvore = { ...arvoreVazia(), config };
  arvore.comboios = Array.from({ length: Math.min(comboios, LIMITES.comboios) }, () => ({ tanques: 0, bicos: 0 }));
  if (!temPista) return arvore;

  const postos = limitar(postosInformados || 1, LIMITES.postos);
  const ilhasPorPosto = limitar(Math.ceil((pistas || postos) / postos), LIMITES.ilhas);
  const ilhasTotal = postos * ilhasPorPosto;
  const bombasPorIlha = limitar(Math.ceil((bombasTotal || ilhasTotal) / ilhasTotal), LIMITES.bombas);
  const bombasReais = ilhasTotal * bombasPorIlha;
  const bicosPorBomba = bicosTotal ? Math.max(1, Math.round(bicosTotal / bombasReais)) : 1;

  arvore.postos = Array.from({ length: postos }, () => ({
    ilhas: Array.from({ length: ilhasPorPosto }, () => ({
      bombas: Array.from({ length: bombasPorIlha }, () => ({ bicos: bicosPorBomba })),
    })),
  }));
  return arvore;
}

/** true quando a estrutura ainda não tem nada definido (nada a perder ao preencher sozinho). */
export function estruturaEhVazia(a: ArvoreEscopo): boolean {
  return !a.postos.length && !a.comboios.length && !a.tanquesLubrificante.length && !a.sondas.length && !a.frota.ativo;
}
