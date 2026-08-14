/**
 * Server-only: renderiza o laudo estruturado (blocos) em PDF com pdf-lib.
 * Puro JS — compatível com o runtime Worker.
 */
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { BlocoLaudo } from "@/lib/laudo/tipos";
import { limparTexto } from "@/lib/texto";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 45;
const HEADER_H = 82;
const FOOTER_H = 36;
const TOP = PAGE_H - HEADER_H - 22;
const BOTTOM = FOOTER_H + 14;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

const NAVY = rgb(0.102, 0.141, 0.212);
const BLUE = rgb(0.231, 0.51, 0.965);
const GREY = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.85, 0.87, 0.9);
const BORDA = rgb(0.35, 0.38, 0.43);
const AMBER = rgb(0.72, 0.45, 0.05);
const RED = rgb(0.75, 0.15, 0.15);
const TINTA = rgb(0.12, 0.13, 0.16);

export type LaudoPdfMeta = {
  titulo: string;
  codigo: string | null;
  revisao: string | null;
  empresaNome: string;
  logoBytes?: Uint8Array | null;
  logoMime?: string | null;
  cliente: string;
  unidade: string;
  data: string;
  agente: string;
  /** cabeçalho padrão do formulário FR-31-10 */
  codigoDocumento?: string | null;
  elaboradoPor?: string | null;
  aprovadoPor?: string | null;
  revisaoDocumento?: string | null;
  dataRevisao?: string | null;
  analista?: string | null;
  especialista?: string | null;
};

type Ctx = {
  pdf: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
  pages: PDFPage[];
  meta: LaudoPdfMeta;
  logo: { img: any; w: number; h: number } | null;
};


function sanitize(s: string): string {
  return limparTexto(s ?? "")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\x20-\x7E\u00C0-\u00FF]/g, "");
}


function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const out: string[] = [];
  for (const para of sanitize(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) <= maxW) line = test;
      else {
        if (line) out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out.length ? out : [""];
}

async function loadLogo(pdf: PDFDocument, meta: LaudoPdfMeta) {
  if (!meta.logoBytes) return null;
  try {
    const img =
      meta.logoMime?.includes("png") || !meta.logoMime
        ? await pdf.embedPng(meta.logoBytes)
        : await pdf.embedJpg(meta.logoBytes);
    const h = 24;
    return { img, w: (img.width / img.height) * h, h };
  } catch {
    return null;
  }
}

/** Cabeçalho padrão do formulário: quadro com título, código e linha de controle. */
function drawHeader(ctx: Ctx) {
  const { page, meta } = ctx;
  const topo = PAGE_H - 24;
  const linhaControleH = 16;
  const tituloH = 40;
  const alturaQuadro = tituloH + linhaControleH;
  const base = topo - alturaQuadro;
  const larguraCodigo = 108;
  const xCodigo = MARGIN_X + CONTENT_W - larguraCodigo;

  const box = (x: number, y: number, w: number, h: number) =>
    page.drawRectangle({ x, y, width: w, height: h, borderColor: BORDA, borderWidth: 0.8 });

  box(MARGIN_X, base, CONTENT_W, alturaQuadro);
  box(MARGIN_X, base + linhaControleH, CONTENT_W - larguraCodigo, tituloH);
  box(xCodigo, base + linhaControleH, larguraCodigo, tituloH);

  // logo à esquerda dentro da célula do título
  let xTitulo = MARGIN_X + 8;
  if (ctx.logo) {
    page.drawImage(ctx.logo.img, {
      x: xTitulo,
      y: base + linhaControleH + (tituloH - ctx.logo.h) / 2,
      width: ctx.logo.w,
      height: ctx.logo.h,
    });
    xTitulo += ctx.logo.w + 10;
  }
  const titulo = sanitize("RESULTADO DE MAPEAMENTO TÉCNICO");
  const disponivel = CONTENT_W - larguraCodigo - (xTitulo - MARGIN_X) - 8;
  const tw = ctx.bold.widthOfTextAtSize(titulo, 12);
  page.drawText(titulo, {
    x: xTitulo + Math.max(0, (disponivel - tw) / 2),
    y: base + linhaControleH + tituloH / 2 - 4,
    size: 12,
    font: ctx.bold,
    color: NAVY,
  });

  const rotulo = "Código";
  const rw = ctx.font.widthOfTextAtSize(rotulo, 8);
  page.drawText(rotulo, {
    x: xCodigo + (larguraCodigo - rw) / 2,
    y: base + linhaControleH + tituloH - 15,
    size: 8,
    font: ctx.font,
    color: GREY,
  });
  const cod = sanitize(meta.codigoDocumento || "FR-31-10");
  const cw = ctx.bold.widthOfTextAtSize(cod, 11);
  page.drawText(cod, {
    x: xCodigo + (larguraCodigo - cw) / 2,
    y: base + linhaControleH + 10,
    size: 11,
    font: ctx.bold,
    color: NAVY,
  });

  const controle = sanitize(
    `Elaborado por: ${meta.elaboradoPor || "—"}      Aprovado por: ${meta.aprovadoPor || "—"}      ` +
      `Revisão: ${meta.revisaoDocumento || meta.revisao || "01"}      Data da revisão: ${meta.dataRevisao || "—"}`,
  );
  page.drawText(controle, {
    x: MARGIN_X + 6,
    y: base + 5,
    size: 7,
    font: ctx.font,
    color: rgb(0.25, 0.27, 0.31),
  });
}


function drawFooter(page: PDFPage, font: PDFFont, meta: LaudoPdfMeta, i: number, total: number) {
  page.drawLine({
    start: { x: MARGIN_X, y: FOOTER_H },
    end: { x: PAGE_W - MARGIN_X, y: FOOTER_H },
    thickness: 0.6,
    color: LINE,
  });
  page.drawText(sanitize(meta.empresaNome), {
    x: MARGIN_X,
    y: FOOTER_H - 14,
    size: 8,
    font,
    color: GREY,
  });
  const p = `Página ${i} de ${total}`;
  const w = font.widthOfTextAtSize(p, 8);
  page.drawText(p, { x: PAGE_W - MARGIN_X - w, y: FOOTER_H - 14, size: 8, font, color: GREY });
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.pdf.addPage([PAGE_W, PAGE_H]);
  ctx.pages.push(ctx.page);
  drawHeader(ctx);
  ctx.y = TOP;
}

function need(ctx: Ctx, h: number) {
  if (ctx.y - h < BOTTOM) newPage(ctx);
}

function paragraph(ctx: Ctx, text: string, size = 10, indent = 14) {
  const lines = wrap(text, ctx.font, size, CONTENT_W - indent);
  for (const line of lines) {
    need(ctx, size + 5);
    // destaca pendências em âmbar
    const cor = line.includes("[CONFIRMAR:") ? AMBER : TINTA;
    ctx.page.drawText(line, {
      x: MARGIN_X + indent,
      y: ctx.y,
      size,
      font: ctx.font,
      color: cor,
    });
    ctx.y -= size + 5;
  }
  ctx.y -= 6;
}

function heading(ctx: Ctx, numero: string | null, texto: string, nivelBruto: 1 | 2 | 3 | 4) {
  const nivel = (nivelBruto > 3 ? 3 : nivelBruto) as 1 | 2 | 3;
  const size = nivel === 1 ? 11.5 : nivel === 2 ? 10.5 : 10;
  // reserva espaço para o título + início do conteúdo (evita título órfão)
  need(ctx, size + 60);
  ctx.y -= nivel === 1 ? 10 : 6;
  // padrão FR-31-10: numeração com ponto final e título em caixa alta
  const label = sanitize(
    `${numero ? `${numero}. ` : ""}${texto}`.toLocaleUpperCase("pt-BR"),
  );
  ctx.page.drawText(label, {
    x: MARGIN_X + (nivel === 1 ? 0 : nivel === 2 ? 8 : 20),
    y: ctx.y,
    size,
    font: ctx.bold,
    color: NAVY,
  });
  ctx.y -= size + 8;
}


function bullets(ctx: Ctx, itens: string[]) {
  for (const it of itens) {
    const lines = wrap(it, ctx.font, 9.5, CONTENT_W - 14);
    lines.forEach((line, i) => {
      need(ctx, 14);
      if (i === 0) {
        ctx.page.drawText("•", { x: MARGIN_X + 2, y: ctx.y, size: 9.5, font: ctx.bold, color: BLUE });
      }
      ctx.page.drawText(line, {
        x: MARGIN_X + 14,
        y: ctx.y,
        size: 9.5,
        font: ctx.font,
        color: line.includes("[CONFIRMAR:") ? AMBER : rgb(0.15, 0.17, 0.2),
      });
      ctx.y -= 13;
    });
    ctx.y -= 2;
  }
  ctx.y -= 4;
}

function table(
  ctx: Ctx,
  titulo: string | null,
  colunas: string[],
  linhas: { celulas: string[]; nota?: string | null }[],
) {
  if (!linhas.length) return;

  const n = colunas.length;
  // primeira coluna estreita (código), segunda larga (descrição)
  const pesos = colunas.map((_, i) => (i === 0 ? 1.1 : i === 1 ? 2.6 : 1));
  const soma = pesos.reduce((a, b) => a + b, 0);
  const larguras = pesos.map((p) => (p / soma) * CONTENT_W);
  const size = 8.5;

  const alturaLinha = (cells: string[], bolded: boolean) => {
    const wrapped = cells.map((c, i) =>
      wrap(c, bolded ? ctx.bold : ctx.font, size, larguras[i]! - 8),
    );
    const rows = Math.max(...wrapped.map((w) => w.length));
    return { wrapped, h: rows * (size + 3) + 8 };
  };

  const drawRow = (cells: string[], bolded: boolean, bg?: boolean) => {
    const { wrapped, h } = alturaLinha(cells, bolded);
    if (bg) {
      ctx.page.drawRectangle({
        x: MARGIN_X,
        y: ctx.y - h + (size + 3),
        width: CONTENT_W,
        height: h,
        color: bolded ? rgb(0.93, 0.95, 0.98) : rgb(0.98, 0.98, 0.99),
      });
    }
    let x = MARGIN_X;
    wrapped.forEach((lines, i) => {
      lines.forEach((line, li) => {
        ctx.page.drawText(line, {
          x: x + 4,
          y: ctx.y - li * (size + 3),
          size,
          font: bolded ? ctx.bold : ctx.font,
          color: line.includes("[CONFIRMAR:") ? AMBER : bolded ? NAVY : rgb(0.18, 0.2, 0.24),
        });
      });
      x += larguras[i]!;
    });
    ctx.y -= h;
    ctx.page.drawLine({
      start: { x: MARGIN_X, y: ctx.y + (size + 3) - 2 },
      end: { x: PAGE_W - MARGIN_X, y: ctx.y + (size + 3) - 2 },
      thickness: 0.5,
      color: LINE,
    });
  };

  const drawTitulo = (cont: boolean) => {
    if (!titulo) return;
    ctx.page.drawText(sanitize(cont ? `${titulo} (cont.)` : titulo), {
      x: MARGIN_X,
      y: ctx.y,
      size: 9.5,
      font: ctx.bold,
      color: NAVY,
    });
    ctx.y -= 14;
  };

  const alturaCabecalho = (titulo ? 14 : 0) + alturaLinha(colunas.slice(0, n), true).h;
  const primeira = alturaLinha(linhas[0]!.celulas.slice(0, n), false).h;

  // título + cabeçalho + primeira linha nunca se separam
  need(ctx, alturaCabecalho + primeira + 8);
  drawTitulo(false);
  drawRow(colunas.slice(0, n), true, true);

  linhas.forEach((l, i) => {
    const cells = l.celulas.slice(0, n);
    const { h } = alturaLinha(cells, false);
    if (ctx.y - (h + 4) < BOTTOM) {
      newPage(ctx);
      drawTitulo(true);
      drawRow(colunas.slice(0, n), true, true);
    }
    drawRow(cells, false, i % 2 === 1);
  });
  ctx.y -= 8;
}


function notes(ctx: Ctx, itens: string[]) {
  for (const it of itens) {
    const lines = wrap(`Obs.: ${it}`, ctx.font, 8.5, CONTENT_W - 10);
    for (const line of lines) {
      need(ctx, 12);
      ctx.page.drawText(line, { x: MARGIN_X + 6, y: ctx.y, size: 8.5, font: ctx.font, color: GREY });
      ctx.y -= 11;
    }
  }
  ctx.y -= 6;
}

function alerta(ctx: Ctx, severidade: "info" | "bloqueante", texto: string) {
  const cor = severidade === "bloqueante" ? RED : AMBER;
  const lines = wrap(texto, ctx.font, 9, CONTENT_W - 24);
  const h = lines.length * 12 + 14;
  need(ctx, h + 6);
  ctx.page.drawRectangle({
    x: MARGIN_X,
    y: ctx.y - h + 10,
    width: CONTENT_W,
    height: h,
    color: severidade === "bloqueante" ? rgb(0.99, 0.94, 0.94) : rgb(1, 0.97, 0.9),
  });
  ctx.page.drawRectangle({
    x: MARGIN_X,
    y: ctx.y - h + 10,
    width: 3,
    height: h,
    color: cor,
  });
  ctx.page.drawText(severidade === "bloqueante" ? "ATENÇÃO" : "OBSERVAÇÃO TÉCNICA", {
    x: MARGIN_X + 12,
    y: ctx.y,
    size: 8,
    font: ctx.bold,
    color: cor,
  });
  ctx.y -= 12;
  for (const line of lines) {
    ctx.page.drawText(line, { x: MARGIN_X + 12, y: ctx.y, size: 9, font: ctx.font, color: cor });
    ctx.y -= 12;
  }
  ctx.y -= 10;
}

const cacheFiguras = new Map<string, { bytes: Uint8Array; mime: string } | null>();

async function carregarFigura(url: string, baseUrl?: string | null) {
  if (cacheFiguras.has(url)) return cacheFiguras.get(url) ?? null;
  let out: { bytes: Uint8Array; mime: string } | null = null;
  try {
    const absoluta = url.startsWith("http") ? url : `${(baseUrl ?? "").replace(/\/$/, "")}${url}`;
    if (absoluta.startsWith("http")) {
      const res = await fetch(absoluta);
      if (res.ok) {
        out = {
          bytes: new Uint8Array(await res.arrayBuffer()),
          mime: res.headers.get("content-type") ?? "image/png",
        };
      }
    }
  } catch {
    out = null;
  }
  cacheFiguras.set(url, out);
  return out;
}

async function figura(
  ctx: Ctx,
  bloco: Extract<BlocoLaudo, { tipo: "image" }>,
  baseUrl?: string | null,
) {
  const dados = await carregarFigura(bloco.url, baseUrl);
  if (!dados) return;
  let img: any;
  try {
    img = dados.mime.includes("jpeg") || dados.mime.includes("jpg")
      ? await ctx.pdf.embedJpg(dados.bytes)
      : await ctx.pdf.embedPng(dados.bytes);
  } catch {
    return;
  }
  const maxW = Math.min(bloco.larguraMax ?? 360, CONTENT_W);
  const w = Math.min(maxW, img.width);
  const h = (img.height / img.width) * w;
  const legendaLines = bloco.legenda ? wrap(bloco.legenda, ctx.font, 8.5, CONTENT_W) : [];
  need(ctx, h + legendaLines.length * 11 + 16);
  const x = MARGIN_X + (CONTENT_W - w) / 2;
  ctx.y -= 6;
  ctx.page.drawImage(img, { x, y: ctx.y - h, width: w, height: h });
  ctx.y -= h + 10;
  for (const line of legendaLines) {
    const lw = ctx.font.widthOfTextAtSize(line, 8.5);
    ctx.page.drawText(line, {
      x: MARGIN_X + (CONTENT_W - lw) / 2,
      y: ctx.y,
      size: 8.5,
      font: ctx.font,
      color: GREY,
    });
    ctx.y -= 11;
  }
  ctx.y -= 6;
}

export async function buildLaudoPdf(input: {
  meta: LaudoPdfMeta;
  blocos: BlocoLaudo[];
  /** origem absoluta usada para resolver URLs de figuras relativas */
  baseUrl?: string | null;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await loadLogo(pdf, input.meta);

  const ctx: Ctx = {
    pdf,
    page: null as unknown as PDFPage,
    y: TOP,
    font,
    bold,
    pages: [],
    meta: input.meta,
    logo,
  };
  newPage(ctx);

  // Identificação — quadro do padrão FR-31-10
  identificacao(ctx);


  for (const b of input.blocos) {
    if (b.oculto) continue;
    switch (b.tipo) {
      case "heading":
        heading(ctx, b.numero, b.texto, b.nivel);
        break;
      case "paragraph":
        paragraph(ctx, b.texto);
        break;
      case "bullets":
        bullets(ctx, b.itens);
        break;
      case "table":
        table(ctx, b.titulo, b.colunas, b.linhas);
        break;
      case "notes":
        notes(ctx, b.itens);
        break;
      case "alert":
        alerta(ctx, b.severidade, b.texto);
        break;
      case "observacao":
        alerta(ctx, "info", `${b.titulo || "OBSERVAÇÃO TÉCNICA"}: ${b.texto}`);
        break;
      case "pagebreak":
        newPage(ctx);
        break;
      case "image":
        await figura(ctx, b, input.baseUrl);
        break;
    }
  }


  ctx.pages.forEach((p, i) => drawFooter(p, font, input.meta, i + 1, ctx.pages.length));
  return pdf.save();
}
