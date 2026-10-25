// Geometria do desenho técnico (funções puras, testadas). Medidas em fração (0–1) da foto.
import type { Anotacao, ItemPeca, TipoAnotacao } from "./tipos";

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const LIMITES = { minLado: 0.03, maxLarg: 1.9, maxAlt: 1.5 } as const;

/**
 * Tamanho inicial de uma peça: altura padrão de 26% da foto (peças muito largas, como a ilha,
 * ficam mais baixas) e largura que mantém a proporção da figura na foto.
 */
export function tamanhoInicial(proporcao: number, proporcaoFoto: number, alturaInicial?: number): { w: number; h: number } {
  let h = alturaInicial ? alturaInicial : proporcao > 3 ? Math.max(0.09, Math.round(80 / proporcao) / 100) : 0.26;
  let w = (proporcao * h) / (proporcaoFoto || 1);
  // peça com altura própria não pode nascer mais larga que 45% da foto (foto vertical, peça larga)
  if (alturaInicial && w > 0.45) {
    h *= 0.45 / w;
    w = 0.45;
  }
  return { w, h };
}

/** Peça nova no ponto clicado: o clique marca a base da peça (como no protótipo). */
export function novaPeca(
  id: string,
  pecaId: string,
  proporcao: number,
  proporcaoFoto: number,
  clique: { x: number; y: number },
  alturaInicial?: number,
): ItemPeca {
  const { w, h } = tamanhoInicial(proporcao, proporcaoFoto, alturaInicial);
  return {
    id,
    tipo: "peca",
    pecaId,
    cx: clamp(clique.x, 0, 1),
    cy: clamp(clique.y - h / 2, 0, 1),
    w,
    h,
    rot: 0,
    nota: "",
  };
}

/** Posição (em px) do canto superior direito da peça, já girada: onde fica o número. */
export function cantoNumero(item: ItemPeca, larg: number, alt: number): { x: number; y: number } {
  const rad = (item.rot * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = (item.w * larg) / 2;
  const dy = -(item.h * alt) / 2;
  return { x: item.cx * larg + dx * cos - dy * sin, y: item.cy * alt + dx * sin + dy * cos };
}

/** Ângulo (graus) do giro a partir do centro da peça até o ponteiro, com "ímã" de 15° opcional. */
export function anguloDoGiro(centro: { x: number; y: number }, ponteiro: { x: number; y: number }, imaDe15 = false): number {
  let ang = (Math.atan2(ponteiro.y - centro.y, ponteiro.x - centro.x) * 180) / Math.PI + 90;
  if (imaDe15) ang = Math.round(ang / 15) * 15;
  return clamp(ang, -179, 179);
}

/** Largura/altura novas ao arrastar uma alça: distância do ponteiro ao centro, dobrada. */
export const ladoPorArraste = (centro: number, ponteiro: number, min: number, max: number) =>
  clamp(Math.abs(ponteiro - centro) * 2, min, max);

/** Quebra o texto em linhas que cabem em `larguraMax` (a medição vem de fora: canvas ou teste). */
export function quebrarTexto(medir: (texto: string) => number, texto: string, larguraMax: number): string[] {
  const palavras = (texto || "").split(/\s+/).filter(Boolean);
  const linhas: string[] = [];
  let atual = "";
  for (const p of palavras) {
    const tentativa = atual ? `${atual} ${p}` : p;
    if (!atual || medir(tentativa) <= larguraMax) atual = tentativa;
    else {
      linhas.push(atual);
      atual = p;
    }
  }
  if (atual) linhas.push(atual);
  return linhas.length ? linhas : [""];
}

// ----- itens: número × balão e ordem de empilhamento -----

/** Itens na ordem em que são desenhados (de trás para a frente). */
export function ordemDeDesenho(itens: ItemPeca[]): ItemPeca[] {
  return itens
    .map((it, i) => ({ it, i }))
    .sort((a, b) => (a.it.z ?? 0) - (b.it.z ?? 0) || a.i - b.i)
    .map((x) => x.it);
}

/** Número de cada item que vai para a legenda (os que viram balão não são numerados). */
export function numeracaoDosItens(itens: ItemPeca[]): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const it of itens) if (it.modo !== "balao") mapa.set(it.id, mapa.size + 1);
  return mapa;
}

/** Balão equivalente de um item em modo "balão": aponta para a peça e leva o texto dado. */
export function anotacaoDoItem(item: ItemPeca, texto: string): Anotacao {
  const padrao = {
    x: clamp(item.cx + (item.cx > 0.5 ? -1 : 1) * (item.w / 2 + 0.1), 0.04, 0.96),
    y: clamp(item.cy - item.h / 2 - 0.08, 0.04, 0.96),
  };
  return { id: `b:${item.id}`, tipo: "balao", pts: [{ x: item.cx, y: item.cy }, item.bal ?? padrao], texto };
}

/** Maior (ou menor) `z` entre os itens, para trazer um item para a frente (ou enviá-lo para trás). */
export const proximoZ = (itens: ItemPeca[], direcao: "frente" | "tras") =>
  direcao === "frente" ? Math.max(0, ...itens.map((i) => i.z ?? 0)) + 1 : Math.min(0, ...itens.map((i) => i.z ?? 0)) - 1;

// ----- anotações (balão, cota, caixa, seta, linha, texto) -----

export const PONTOS_POR_TIPO: Record<TipoAnotacao, number> = { balao: 2, cota: 2, caixa: 2, seta: 2, linha: 2, texto: 1 };

/** Anotação nova. Balão e texto nascem num clique; as demais nascem com início = fim e o arraste define o fim. */
export function novaAnotacao(id: string, tipo: TipoAnotacao, ini: { x: number; y: number }): Anotacao {
  const a = { x: clamp(ini.x, 0, 1), y: clamp(ini.y, 0, 1) };
  if (tipo === "texto") return { id, tipo, pts: [a], texto: "" };
  if (tipo === "balao") {
    const lado = a.x > 0.5 ? -0.12 : 0.12;
    return { id, tipo, pts: [a, { x: clamp(a.x + lado, 0.04, 0.96), y: clamp(a.y - 0.14, 0.04, 0.96) }], texto: "" };
  }
  return { id, tipo, pts: [a, { ...a }], texto: "" };
}

/** Desloca todos os pontos, sem deixar nenhum sair da foto. */
export function moverPontos(pts: { x: number; y: number }[], dx: number, dy: number) {
  const minX = Math.min(...pts.map((p) => p.x));
  const maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));
  const ddx = clamp(dx, -minX, 1 - maxX);
  const ddy = clamp(dy, -minY, 1 - maxY);
  return pts.map((p) => ({ x: p.x + ddx, y: p.y + ddy }));
}

/** Anotação de dois pontos praticamente sem tamanho (clique sem arraste). */
export const anotacaoVazia = (a: Anotacao, minimo = 0.012) =>
  PONTOS_POR_TIPO[a.tipo] === 2 && a.tipo !== "balao" && Math.hypot(a.pts[1].x - a.pts[0].x, a.pts[1].y - a.pts[0].y) < minimo;

export const COR_ANOTACAO = { azul: "#2F6FED", vermelho: "#D92D20", laranja: "#F79009", escuro: "#10202e", branco: "#ffffff" } as const;

/** Formas básicas em pixels: a tela (SVG) e a exportação (canvas) desenham exatamente a mesma lista. */
export type Primitiva =
  | { k: "linha"; x1: number; y1: number; x2: number; y2: number; cor: string; lw: number; tracejado?: boolean }
  | { k: "rect"; x: number; y: number; w: number; h: number; cor: string; lw: number; tracejado?: boolean }
  | { k: "circ"; x: number; y: number; r: number; fundo: string; cor?: string; lw?: number }
  | { k: "etiqueta"; cx: number; cy: number; w: number; h: number; linhas: string[]; tam: number; cor: string; fundo: string; borda?: string; raio: number };

export type OpcoesPrimitivas = {
  /** tamanho mínimo da fonte (na tela, para não ficar ilegível em foto pequena) */
  minTam?: number;
  /** texto exibido quando a anotação ainda não tem texto (só na edição) */
  vazio?: string;
};

export function primitivasDaAnotacao(
  a: Anotacao,
  W: number,
  H: number,
  medir: (texto: string, tam: number) => number,
  opcoes: OpcoesPrimitivas = {},
): Primitiva[] {
  const u = W / 1000;
  const lw = Math.max(2, 4 * u);
  const tam = Math.max(opcoes.minTam ?? 0, 20 * u);
  const p = a.pts.map((q) => ({ x: q.x * W, y: q.y * H }));
  const texto = a.texto.trim() || opcoes.vazio || "";
  // texto longo quebra em várias linhas (largura máxima ~28% da foto) e a caixa não sai da foto
  const etiqueta = (cx: number, cy: number, cor: string, fundo: string, borda?: string): Primitiva => {
    const pad = tam * 0.45;
    const linhas = quebrarTexto((t) => medir(t, tam), texto, Math.max(tam * 6, W * 0.28));
    const w = Math.max(...linhas.map((l) => medir(l, tam))) + pad * 2;
    const h = linhas.length * tam * 1.25 + pad * 0.9;
    return { k: "etiqueta", cx: clamp(cx, w / 2, Math.max(w / 2, W - w / 2)), cy: clamp(cy, h / 2, Math.max(h / 2, H - h / 2)), w, h, linhas, tam, cor, fundo, borda, raio: tam * 0.35 };
  };
  const { azul, vermelho, laranja, escuro, branco } = COR_ANOTACAO;
  const out: Primitiva[] = [];

  switch (a.tipo) {
    case "balao": {
      const [alvo, balao] = p;
      const r = Math.max(4, 6 * u);
      out.push({ k: "linha", x1: balao.x, y1: balao.y, x2: alvo.x, y2: alvo.y, cor: azul, lw });
      out.push({ k: "circ", x: alvo.x, y: alvo.y, r, fundo: azul, cor: branco, lw: Math.max(1.5, lw * 0.5) });
      if (texto) out.push(etiqueta(balao.x, balao.y, escuro, branco, azul));
      else out.push({ k: "circ", x: balao.x, y: balao.y, r: tam * 0.8, fundo: branco, cor: azul, lw });
      break;
    }
    case "cota": {
      const [a1, a2] = p;
      const d = Math.hypot(a2.x - a1.x, a2.y - a1.y) || 1;
      const nx = (-(a2.y - a1.y) / d) * tam * 0.6;
      const ny = ((a2.x - a1.x) / d) * tam * 0.6;
      out.push({ k: "linha", x1: a1.x, y1: a1.y, x2: a2.x, y2: a2.y, cor: vermelho, lw });
      out.push({ k: "linha", x1: a1.x - nx, y1: a1.y - ny, x2: a1.x + nx, y2: a1.y + ny, cor: vermelho, lw });
      out.push({ k: "linha", x1: a2.x - nx, y1: a2.y - ny, x2: a2.x + nx, y2: a2.y + ny, cor: vermelho, lw });
      if (texto) out.push(etiqueta((a1.x + a2.x) / 2, (a1.y + a2.y) / 2, vermelho, branco, vermelho));
      break;
    }
    case "caixa": {
      const x = Math.min(p[0].x, p[1].x);
      const y = Math.min(p[0].y, p[1].y);
      out.push({ k: "rect", x, y, w: Math.abs(p[1].x - p[0].x), h: Math.abs(p[1].y - p[0].y), cor: laranja, lw, tracejado: true });
      if (texto) {
        const e = etiqueta(0, 0, escuro, branco, laranja) as Extract<Primitiva, { k: "etiqueta" }>;
        out.push({ ...e, cx: x + e.w / 2, cy: Math.max(e.h / 2, y - e.h / 2) });
      }
      break;
    }
    case "seta": {
      const [a1, a2] = p;
      const asa = tam * 1.1;
      const ang = Math.atan2(a2.y - a1.y, a2.x - a1.x);
      out.push({ k: "linha", x1: a1.x, y1: a1.y, x2: a2.x, y2: a2.y, cor: vermelho, lw });
      for (const lado of [-1, 1]) {
        const t = ang + Math.PI + (lado * Math.PI) / 7;
        out.push({ k: "linha", x1: a2.x, y1: a2.y, x2: a2.x + Math.cos(t) * asa, y2: a2.y + Math.sin(t) * asa, cor: vermelho, lw });
      }
      break;
    }
    case "linha":
      out.push({ k: "linha", x1: p[0].x, y1: p[0].y, x2: p[1].x, y2: p[1].y, cor: azul, lw: lw * 1.8 });
      break;
    case "texto":
      if (texto) out.push(etiqueta(p[0].x, p[0].y, escuro, "rgba(255,255,255,0.92)"));
      break;
  }
  return out;
}
