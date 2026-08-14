// Figuras institucionais fixas do laudo (mesma imagem em todos os documentos).
import bicoNldiv from "@/assets/bico-automatizado-nldiv.png.asset.json";
import ponteiraNldiv from "@/assets/ponteira-nldiv.png.asset.json";

export type FiguraLaudo = {
  url: string;
  alt: string;
  legendaBase: string;
  larguraMax: number;
};

/** Bico automatizado com a Solução NLDIV Wireless V2+ (desenho padrão, pág. 9). */
export const FIGURA_BICO_NLDIV: FiguraLaudo = {
  url: bicoNldiv.url,
  alt: "Desenho padrão do bico automatizado com NLDIV Wireless V2+",
  legendaBase: "Bico automatizado com a Solução NLDIV Wireless V2+",
  larguraMax: 360,
};

/** Ponteira do bico com a NLDIV Wireless acoplada (antena/leitor). */
export const FIGURA_PONTEIRA_NLDIV: FiguraLaudo = {
  url: ponteiraNldiv.url,
  alt: "Desenho padrão da ponteira do bico com a NLDIV Wireless (antena/leitor) acoplada",
  legendaBase: "Ponteira do bico com a NLDIV Wireless (antena/leitor) acoplada",
  larguraMax: 340,
};

/**
 * Desenhos técnicos estruturais do Nível 2 — assets estáticos do projeto
 * (public/laudo). Não dependem de upload por caso nem de URL assinada.
 */
export const FIGURA_N2_BICO: FiguraLaudo = {
  // desenho real recortado do documento oficial (fallback vetorial no PDF)
  url: bicoNldiv.url,
  alt: "Desenho técnico do bico de abastecimento com Módulo Bico Wireless e NLDIV",
  legendaBase: "Bico automatizado com a Solução NLDIV Wireless",
  larguraMax: 400,
};

export const FIGURA_N2_PONTEIRA: FiguraLaudo = {
  url: ponteiraNldiv.url,
  alt: "Detalhe técnico da ponteira com NLDIV Wireless acoplada e aumento do diâmetro externo",
  legendaBase: "Ponteira do bico com a NLDIV Wireless (antena/leitor) acoplada",
  larguraMax: 400,
};

export const FIGURA_N2_SUPORTE: FiguraLaudo = {
  url: "/laudo/nivel2-suporte-comboio.svg",
  alt: "Esboço técnico do suporte/descanso do bico para Caminhões Comboio",
  legendaBase:
    "Esboço sugerido do Suporte de Bico em barra chata galvanizada 2\u201d x 3/16\u201d (50,80 x 4,75 mm)",
  larguraMax: 380,
};

/**
 * Compatibilidade: a seção 2.4 do template principal usava esta constante.
 */
export const FIGURA_SUPORTE_BICO = FIGURA_BICO_NLDIV;
