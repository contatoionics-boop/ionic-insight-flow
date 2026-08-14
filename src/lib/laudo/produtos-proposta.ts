// Converte os itens da PROPOSTA COMERCIAL em linhas da tabela "Produtos IONICS".
// Conservador por definição: nada é inferido de catálogo nem de regra técnica.
// Puro e client-safe.

import type { EscopoProposta } from "@/lib/proposta/tipos";

export type ProdutoProposta = {
  codigo: string | null;
  descricao: string;
  quantidade: string | null;
};

const LIMIAR_CONFIANCA_ITENS = 0.45;

/** códigos IONICS (2.0.08.00.00S) ou códigos alfanuméricos claramente destacados */
const RE_CODIGO = /^\s*(?:c[óo]d(?:igo)?[.:]?\s*)?((?:\d+\.){2,}[0-9A-Z]+|[A-Z]{2,}[-–]?\d{2,}[A-Z0-9-]*)\s*[-–—:]\s*/i;
/** quantidades explícitas: "2x ", " - 2 un", "(qtd: 3)", "3 peças" */
const RE_QTD_PREFIXO = /^\s*(\d{1,3})\s*(?:x|un(?:id(?:ades?)?)?\.?|pç|pcs|peças?)\s*[-–—:]?\s*/i;
const RE_QTD_SUFIXO = /[-–—(,]\s*(?:qtd\.?|quantidade)?\s*:?\s*(\d{1,3})\s*(?:x|un(?:id(?:ades?)?)?\.?|pç|pcs|peças?)\s*\)?\s*$/i;

function limpar(s: string): string {
  return s.replace(/^[\s•\-–—*]+/, "").replace(/[\s.;]+$/, "").trim();
}

/** Interpreta um item textual da proposta de forma determinística. */
export function parsearItemProposta(bruto: string): ProdutoProposta | null {
  let texto = limpar(bruto ?? "");
  if (texto.length < 3) return null;

  let codigo: string | null = null;
  const mCod = texto.match(RE_CODIGO);
  if (mCod) {
    codigo = mCod[1];
    texto = limpar(texto.slice(mCod[0].length));
  }

  let quantidade: string | null = null;
  const mPre = texto.match(RE_QTD_PREFIXO);
  if (mPre) {
    quantidade = mPre[1];
    texto = limpar(texto.slice(mPre[0].length));
  } else {
    const mSuf = texto.match(RE_QTD_SUFIXO);
    if (mSuf) {
      quantidade = mSuf[1];
      texto = limpar(texto.slice(0, mSuf.index ?? texto.length));
    }
  }

  if (!texto) return null;
  return { codigo, descricao: texto, quantidade };
}

/**
 * Produtos contratados, exclusivamente a partir do escopo da proposta.
 * Sem proposta ou sem itens confiáveis → lista vazia (o especialista preenche).
 */
export function produtosDaProposta(
  escopo: Partial<EscopoProposta> | null | undefined,
): ProdutoProposta[] {
  const campo = escopo?.itens_inclusos;
  if (!campo) return [];
  if (Number(campo.confianca ?? 0) < LIMIAR_CONFIANCA_ITENS) return [];
  const itens = Array.isArray(campo.valor) ? campo.valor : [];
  const linhas: ProdutoProposta[] = [];
  const vistos = new Set<string>();
  for (const item of itens) {
    const p = parsearItemProposta(String(item ?? ""));
    if (!p) continue;
    const chave = `${p.codigo ?? ""}|${p.descricao.toLowerCase()}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    linhas.push(p);
  }
  return linhas;
}
