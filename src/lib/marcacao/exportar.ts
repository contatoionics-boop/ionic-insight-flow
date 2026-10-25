// Desenha o resultado final (foto + peças numeradas + legenda) num canvas. Só roda no navegador.
import { PECAS, BIBLIOTECA, urlDaPeca } from "./biblioteca";
import { anotacaoDoItem, cantoNumero, numeracaoDosItens, ordemDeDesenho, primitivasDaAnotacao, quebrarTexto, type Primitiva } from "./geometria";
import type { Anotacao, ItemDesenho } from "./tipos";

/** Largura máxima do arquivo exportado (mantém o PDF leve). */
export const LARGURA_MAX_EXPORTACAO = 2000;

const FONTE_MONO = 'Consolas,"Cascadia Mono",monospace';
export const FONTE_UI = '"Segoe UI",system-ui,sans-serif';

export function carregarImagem(src: string, crossOrigin = false): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível carregar a imagem."));
    img.src = src;
  });
}

/**
 * Baixa a foto e devolve um endereço local (blob:). Assim o navegador não considera o canvas
 * "contaminado" e deixa exportar, mesmo com foto do armazenamento (URL assinada).
 */
export async function fotoComoBlobUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Não foi possível baixar a foto.");
  return URL.createObjectURL(await res.blob());
}

let cachePecas: Promise<Record<string, HTMLImageElement>> | null = null;

/** Carrega as figuras da biblioteca uma única vez. */
export function carregarPecas(): Promise<Record<string, HTMLImageElement>> {
  if (!cachePecas) {
    cachePecas = Promise.all(BIBLIOTECA.map(async (p) => [p.id, await carregarImagem(urlDaPeca(p))] as const))
      .then((pares) => Object.fromEntries(pares))
      .catch((e) => {
        cachePecas = null;
        throw e;
      });
  }
  return cachePecas;
}

/** Largura de um texto de etiqueta (mesma medida na tela e na exportação). */
export function medirEtiqueta(texto: string, tam: number): number {
  const ctx = document.createElement("canvas").getContext("2d")!;
  ctx.font = `600 ${tam}px ${FONTE_UI}`;
  return ctx.measureText(texto).width;
}

function caminhoArredondado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function desenharPrimitivas(ctx: CanvasRenderingContext2D, prims: Primitiva[]) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const p of prims) {
    ctx.save();
    if (p.k === "linha") {
      ctx.strokeStyle = p.cor;
      ctx.lineWidth = p.lw;
      ctx.setLineDash(p.tracejado ? [p.lw * 2.5, p.lw * 2] : []);
      ctx.beginPath();
      ctx.moveTo(p.x1, p.y1);
      ctx.lineTo(p.x2, p.y2);
      ctx.stroke();
    } else if (p.k === "rect") {
      ctx.strokeStyle = p.cor;
      ctx.lineWidth = p.lw;
      ctx.setLineDash(p.tracejado ? [p.lw * 2.5, p.lw * 2] : []);
      ctx.strokeRect(p.x, p.y, p.w, p.h);
    } else if (p.k === "circ") {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.fundo;
      ctx.fill();
      if (p.cor) {
        ctx.strokeStyle = p.cor;
        ctx.lineWidth = p.lw ?? 2;
        ctx.stroke();
      }
    } else {
      caminhoArredondado(ctx, p.cx - p.w / 2, p.cy - p.h / 2, p.w, p.h, p.raio);
      ctx.fillStyle = p.fundo;
      ctx.fill();
      if (p.borda) {
        ctx.strokeStyle = p.borda;
        ctx.lineWidth = Math.max(1.5, p.tam * 0.1);
        ctx.stroke();
      }
      ctx.fillStyle = p.cor;
      ctx.font = `600 ${p.tam}px ${FONTE_UI}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const alturaLinha = p.tam * 1.25;
      const topo = p.cy - (p.linhas.length * alturaLinha) / 2 + alturaLinha / 2;
      p.linhas.forEach((ln, i) => ctx.fillText(ln, p.cx, topo + i * alturaLinha + p.tam * 0.04));
    }
    ctx.restore();
  }
}

export function renderizarDesenho(opts: {
  foto: HTMLImageElement;
  itens: ItemDesenho[];
  anotacoes?: Anotacao[];
  pecas: Record<string, HTMLImageElement>;
  larguraMax?: number;
}): HTMLCanvasElement {
  const { foto, itens, pecas } = opts;
  const naturalW = foto.naturalWidth || foto.width;
  const naturalH = foto.naturalHeight || foto.height;
  const escala = Math.min(1, (opts.larguraMax ?? LARGURA_MAX_EXPORTACAO) / naturalW);
  const W = Math.round(naturalW * escala);
  const H = Math.round(naturalH * escala);

  const pad = Math.round(W * 0.028);
  const nr = W * 0.013;
  const tituloH = Math.round(W * 0.036);
  const tamNome = Math.round(W * 0.0158);
  const tamNota = Math.round(W * 0.0152);
  const alturaLinha = Math.round(W * 0.024);
  const folga = Math.round(W * 0.013);
  const textoX = pad + nr * 2 + 14;
  const larguraTexto = W - textoX - pad;
  const fonteNome = `600 ${tamNome}px ${FONTE_UI}`;
  const fonteNota = `${tamNota}px ${FONTE_UI}`;

  const medidor = document.createElement("canvas").getContext("2d")!;
  const quebrar = (texto: string, fonte: string) => {
    medidor.font = fonte;
    return quebrarTexto((t) => medidor.measureText(t).width, texto, larguraTexto);
  };

  const numeros = numeracaoDosItens(itens);
  const numerados = itens.filter((it) => numeros.has(it.id));
  const blocos = numerados.map((it) => ({
    nome: quebrar(PECAS[it.pecaId]?.completo ?? "Equipamento", fonteNome),
    nota: it.nota ? quebrar(`→ ${it.nota}`, fonteNota) : [],
  }));
  let alturaLegenda = 0;
  if (numerados.length) {
    alturaLegenda = pad + tituloH;
    for (const b of blocos) alturaLegenda += (b.nome.length + b.nota.length) * alturaLinha + folga;
    alturaLegenda += pad;
  }

  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H + alturaLegenda;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.drawImage(foto, 0, 0, W, H);

  ordemDeDesenho(itens).forEach((it) => {
    const img = pecas[it.pecaId];
    const wpx = it.w * W;
    const hpx = it.h * H;
    ctx.save();
    ctx.translate(it.cx * W, it.cy * H);
    ctx.rotate((it.rot * Math.PI) / 180);
    if (img) ctx.drawImage(img, -wpx / 2, -hpx / 2, wpx, hpx);
    ctx.restore();

    const numero = numeros.get(it.id);
    if (numero === undefined) return;
    const { x, y } = cantoNumero(it, W, H);
    const r = Math.max(11, W * 0.014);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = "#2F6FED";
    ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.16);
    ctx.strokeStyle = "#fff";
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = `700 ${r * 1.15}px ${FONTE_MONO}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(numero), x, y + r * 0.05);
  });

  const baloes = itens.filter((it) => it.modo === "balao").map((it) => anotacaoDoItem(it, it.nota.trim() || PECAS[it.pecaId]?.completo || "Equipamento"));
  for (const a of [...baloes, ...(opts.anotacoes ?? [])]) desenharPrimitivas(ctx, primitivasDaAnotacao(a, W, H, medirEtiqueta));

  if (numerados.length) {
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    let y = H + pad;
    ctx.fillStyle = "#10202e";
    ctx.font = `700 ${Math.round(W * 0.017)}px ${FONTE_MONO}`;
    ctx.fillText("ITENS DO SERVIÇO", pad, y);
    y += tituloH;
    blocos.forEach((b, i) => {
      ctx.beginPath();
      ctx.arc(pad + nr, y + tamNome * 0.62, nr, 0, Math.PI * 2);
      ctx.fillStyle = "#2F6FED";
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `700 ${nr * 1.05}px ${FONTE_MONO}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), pad + nr, y + tamNome * 0.62 + 1);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      let ty = y;
      ctx.fillStyle = "#10202e";
      ctx.font = fonteNome;
      for (const ln of b.nome) {
        ctx.fillText(ln, textoX, ty);
        ty += alturaLinha;
      }
      ctx.fillStyle = "#46586b";
      ctx.font = fonteNota;
      for (const ln of b.nota) {
        ctx.fillText(ln, textoX, ty);
        ty += alturaLinha;
      }
      y = ty + folga;
    });
  }
  return cv;
}

export function canvasParaBlob(cv: HTMLCanvasElement, tipo: "image/jpeg" | "image/png" = "image/jpeg", qualidade = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    cv.toBlob((b) => (b ? resolve(b) : reject(new Error("Não foi possível gerar a imagem."))), tipo, qualidade);
  });
}
