// Figuras institucionais fixas do laudo (mesma imagem em todos os documentos).
import bicoNldiv from "@/assets/bico-automatizado-nldiv.png.asset.json";
import ponteiraNldiv from "@/assets/ponteira-nldiv.png.asset.json";

/** Bico automatizado com a Solução NLDIV Wireless V2+ (desenho padrão, pág. 9). */
export const FIGURA_BICO_NLDIV = {
  url: bicoNldiv.url,
  alt: "Desenho padrão do bico automatizado com NLDIV Wireless V2+",
  legendaBase: "Bico automatizado com a Solução NLDIV Wireless V2+",
  larguraMax: 360,
} as const;

/** Ponteira do bico com a NLDIV Wireless acoplada (antena/leitor). */
export const FIGURA_PONTEIRA_NLDIV = {
  url: ponteiraNldiv.url,
  alt: "Desenho padrão da ponteira do bico com a NLDIV Wireless (antena/leitor) acoplada",
  legendaBase: "Ponteira do bico com a NLDIV Wireless (antena/leitor) acoplada",
  larguraMax: 340,
} as const;

/**
 * Compatibilidade: a seção 2.4 do template principal usava esta constante.
 * O asset original era a página de instruções; agora aponta para o desenho
 * correto do bico automatizado.
 */
export const FIGURA_SUPORTE_BICO = FIGURA_BICO_NLDIV;
