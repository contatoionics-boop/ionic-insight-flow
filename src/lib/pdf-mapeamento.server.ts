/**
 * Servidor-only: monta o PDF do mapeamento técnico usando pdf-lib (puro JS).
 * Roda no Cloudflare Worker (sem deps nativas).
 *
 * Rebrand: corpo branco, navy (#1a2436) em cabeçalho/rodapé,
 * azul (#3b82f6) como acento de seção e número do documento.
 */
import {
  PDFDocument,
  PDFFont,
  PDFPage,
  StandardFonts,
  rgb,
  type RGB,
} from "pdf-lib";

// ============================================================
// Tipos de entrada
// ============================================================

export type PdfPergunta = {
  id: string;
  texto: string;
  tipo: string;
  ordem: number;
  instrucao_agente: string | null;
  opcoes?: { id: string; texto: string }[];
};

export type PdfSecao = {
  id: string;
  titulo: string;
  ordem: number;
  descricao: string | null;
  perguntas: PdfPergunta[];
};

export type PdfResposta = {
  pergunta_id: string;
  valor_texto: string | null;
  arquivo_path: string | null;
  transcricao: string | null;
  ia_aprovado: boolean | null;
};

export type PdfEmpresa = {
  nome: string;
  razaoSocial: string | null;
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  cidadeEstado: string | null;
  site: string | null;
};

export type PdfMeta = {
  /** Texto do título principal — vem do nome do formulário */
  titulo: string;
  /** Código do documento (ex: CS-0023) */
  codigo: string | null;
  revisao: string | null;
  dataRevisao: string | null;
  elaboradoPor: string | null;
  aprovadoPor: string | null;
  /** Data do documento exibida no cabeçalho (ex: agendamento) */
  dataDocumento?: string | null;
  /** Logo da empresa — bytes opcionais */
  logoBytes?: Uint8Array | null;
  logoMime?: string | null;
  /** Dados da empresa (configuracoes_empresa) */
  empresa: PdfEmpresa;
};

export type PdfIdentificacao = {
  cliente: string;
  unidade: string;
  data: string;
  responsavel: string;
  contato: string;
};

export type PdfBuildInput = {
  meta: PdfMeta;
  identificacao: PdfIdentificacao;
  secoes: PdfSecao[];
  respostas: Map<string, PdfResposta>;
  /** Bytes de foto por arquivo_path */
  fotos: Map<string, { bytes: Uint8Array; mime: string }>;
};

// ============================================================
// Paleta
// ============================================================
const COR_NAVY: RGB = rgb(0x1a / 255, 0x24 / 255, 0x36 / 255); // #1a2436
const COR_AZUL: RGB = rgb(0x3b / 255, 0x82 / 255, 0xf6 / 255); // #3b82f6
const COR_BORDA: RGB = rgb(0xe5 / 255, 0xe7 / 255, 0xeb / 255); // #e5e7eb
const COR_BORDA_SOFT: RGB = rgb(0xf3 / 255, 0xf4 / 255, 0xf6 / 255); // #f3f4f6
const COR_LABEL_BG: RGB = rgb(0xf8 / 255, 0xfa / 255, 0xfc / 255); // #f8fafc
const COR_LABEL_TXT: RGB = rgb(0x37 / 255, 0x41 / 255, 0x51 / 255); // #374151
const COR_VALUE_TXT: RGB = rgb(0x11 / 255, 0x18 / 255, 0x27 / 255); // #111827
const COR_TITULO: RGB = COR_NAVY;
const COR_MUTED: RGB = rgb(0x6b / 255, 0x72 / 255, 0x80 / 255); // #6b7280
const COR_PLACEHOLDER: RGB = rgb(0x9c / 255, 0xa3 / 255, 0xaf / 255); // #9ca3af
const COR_DASHED: RGB = rgb(0xd1 / 255, 0xd5 / 255, 0xdb / 255); // #d1d5db
const COR_FOOTER_TXT: RGB = rgb(0x94 / 255, 0xa3 / 255, 0xb8 / 255); // #94a3b8
const COR_WHITE: RGB = rgb(1, 1, 1);

// ============================================================
// Layout
// ============================================================
const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN_X = 36;
const HEADER_H = 86;
const FOOTER_H = 40;
const MARGIN_TOP = HEADER_H + 18;
const MARGIN_BOTTOM = FOOTER_H + 10;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

// ============================================================
// Helpers de texto
// ============================================================

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  const paragraphs = text.replace(/\r/g, "").split("\n");
  for (const para of paragraphs) {
    if (!para.trim()) {
      out.push("");
      continue;
    }
    const words = para.split(/\s+/);
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      const width = font.widthOfTextAtSize(test, size);
      if (width > maxWidth && line) {
        out.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

function safeText(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2022]/g, "*")
    .replace(/[\u2026]/g, "...")
    .replace(/[\u00B7]/g, "-")
    .replace(/[^\x00-\xFF\n]/g, "?");
}

// Linha tracejada manual
function drawDashedRect(
  page: PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
  color: RGB,
  dash = 4,
  gap = 3,
  thickness = 0.8,
) {
  const seg = dash + gap;
  // top + bottom
  for (let i = 0; i < w; i += seg) {
    const end = Math.min(i + dash, w);
    page.drawLine({
      start: { x: x + i, y: y + h },
      end: { x: x + end, y: y + h },
      thickness,
      color,
    });
    page.drawLine({
      start: { x: x + i, y },
      end: { x: x + end, y },
      thickness,
      color,
    });
  }
  // left + right
  for (let i = 0; i < h; i += seg) {
    const end = Math.min(i + dash, h);
    page.drawLine({
      start: { x, y: y + i },
      end: { x, y: y + end },
      thickness,
      color,
    });
    page.drawLine({
      start: { x: x + w, y: y + i },
      end: { x: x + w, y: y + end },
      thickness,
      color,
    });
  }
}

// ============================================================
// Header / Footer
// ============================================================

type Ctx = {
  pdf: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  fontBold: PDFFont;
  fontItalic: PDFFont;
  y: number;
  meta: PdfMeta;
  logoImg: { embed: any; w: number; h: number } | null;
  pageNum: number;
};

async function loadLogo(pdf: PDFDocument, meta: PdfMeta) {
  if (!meta.logoBytes || !meta.logoBytes.length) return null;
  try {
    const mime = (meta.logoMime || "").toLowerCase();
    const embed = mime.includes("png")
      ? await pdf.embedPng(meta.logoBytes)
      : await pdf.embedJpg(meta.logoBytes);
    const targetH = 26;
    const scale = targetH / embed.height;
    return { embed, w: embed.width * scale, h: targetH };
  } catch {
    return null;
  }
}

function truncateToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  const ell = "...";
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = text.slice(0, mid) + ell;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + ell;
}

function drawHeader(ctx: Ctx) {
  const { page, font, fontBold, meta, logoImg } = ctx;
  const e = meta.empresa;
  const topY = PAGE_H;
  const headerBottom = PAGE_H - HEADER_H;

  // border-top 4px navy
  page.drawRectangle({
    x: 0,
    y: topY - 4,
    width: PAGE_W,
    height: 4,
    color: COR_NAVY,
  });

  // border-bottom 1px cinza
  page.drawLine({
    start: { x: 0, y: headerBottom },
    end: { x: PAGE_W, y: headerBottom },
    thickness: 0.8,
    color: COR_BORDA,
  });

  // ====== Geometria: divide header em duas colunas ======
  const innerTop = topY - 4 - 8; // abaixo da border-top com respiro
  const innerBottom = headerBottom + 8;
  const innerH = innerTop - innerBottom;
  // coluna direita reservada para título/código/data
  const rightColW = 200;
  const rightX = PAGE_W - MARGIN_X - rightColW;
  // coluna esquerda
  const leftColMaxRight = rightX - 16;

  // ---- Esquerda: caixa navy com logo + info ----
  const boxH = Math.min(36, innerH);
  const boxY = innerBottom + (innerH - boxH) / 2;
  const boxX = MARGIN_X;
  const padBox = 8;
  let boxW = 64;
  if (logoImg) boxW = Math.max(54, logoImg.w + padBox * 2);
  page.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxW,
    height: boxH,
    color: COR_NAVY,
  });
  if (logoImg) {
    const scale = Math.min((boxW - 8) / logoImg.w, (boxH - 8) / logoImg.h, 1);
    const lw = logoImg.w * scale;
    const lh = logoImg.h * scale;
    page.drawImage(logoImg.embed, {
      x: boxX + (boxW - lw) / 2,
      y: boxY + (boxH - lh) / 2,
      width: lw,
      height: lh,
    });
  } else {
    const nome = safeText((e.nome || "").toUpperCase()) || "EMPRESA";
    const size = 10;
    const w = fontBold.widthOfTextAtSize(nome, size);
    page.drawText(nome, {
      x: boxX + (boxW - w) / 2,
      y: boxY + (boxH - size) / 2 + 1,
      size,
      font: fontBold,
      color: COR_WHITE,
    });
  }

  // Info ao lado da caixa, truncada à largura disponível
  const infoX = boxX + boxW + 10;
  const infoMaxW = Math.max(40, leftColMaxRight - infoX);
  const infoSize = 8;

  const linha1Parts: string[] = [];
  if (e.razaoSocial || e.nome) linha1Parts.push(safeText(e.razaoSocial || e.nome));
  if (e.cnpj) linha1Parts.push(`CNPJ ${safeText(e.cnpj)}`);
  const linha1 = truncateToWidth(linha1Parts.join("  •  "), fontBold, infoSize, infoMaxW);

  const linha2Parts: string[] = [];
  if (e.cidadeEstado) linha2Parts.push(safeText(e.cidadeEstado));
  if (e.email) linha2Parts.push(safeText(e.email));
  else if (e.telefone) linha2Parts.push(safeText(e.telefone));
  const linha2 = truncateToWidth(linha2Parts.join("  •  "), font, infoSize, infoMaxW);

  const lineGap = 4;
  const block1Y = boxY + boxH - infoSize - 2;
  const block2Y = block1Y - infoSize - lineGap;
  if (linha1) {
    page.drawText(linha1, {
      x: infoX,
      y: block1Y,
      size: infoSize,
      font: fontBold,
      color: COR_NAVY,
    });
  }
  if (linha2) {
    page.drawText(linha2, {
      x: infoX,
      y: block2Y,
      size: infoSize,
      font,
      color: COR_MUTED,
    });
  }

  // ---- Direita: título (wrap até 2 linhas) + código + data ----
  const titulo = (safeText(meta.titulo) || "DOCUMENTO").toUpperCase();
  let tSize = 10;
  let tLines = wrapText(titulo, fontBold, tSize, rightColW).slice(0, 2);
  // garante que cada linha caiba (truncar a última se necessário)
  if (tLines.length === 2) {
    tLines[1] = truncateToWidth(tLines[1], fontBold, tSize, rightColW);
  } else if (tLines.length === 1) {
    tLines[0] = truncateToWidth(tLines[0], fontBold, tSize, rightColW);
  }
  const tLineH = tSize + 2;
  const codeSize = 12;
  const dataSize = 8;
  const totalRightH = tLines.length * tLineH + 2 + codeSize + 2 + dataSize;
  let ry = innerTop - (innerH - totalRightH) / 2;

  for (const line of tLines) {
    const lw = fontBold.widthOfTextAtSize(line, tSize);
    page.drawText(line, {
      x: PAGE_W - MARGIN_X - lw,
      y: ry - tSize,
      size: tSize,
      font: fontBold,
      color: COR_NAVY,
    });
    ry -= tLineH;
  }
  ry -= 2;

  if (meta.codigo) {
    const code = safeText(meta.codigo);
    const cw = fontBold.widthOfTextAtSize(code, codeSize);
    page.drawText(code, {
      x: PAGE_W - MARGIN_X - cw,
      y: ry - codeSize,
      size: codeSize,
      font: fontBold,
      color: COR_AZUL,
    });
    ry -= codeSize + 2;
  }

  const dataStr = safeText(meta.dataDocumento || "");
  if (dataStr) {
    const dw = font.widthOfTextAtSize(dataStr, dataSize);
    page.drawText(dataStr, {
      x: PAGE_W - MARGIN_X - dw,
      y: ry - dataSize,
      size: dataSize,
      font,
      color: COR_MUTED,
    });
  }
}

function drawFooter(ctx: Ctx, totalPages: number) {
  const { page, font, meta, pageNum } = ctx;
  const e = meta.empresa;
  const footerY = 0;

  // border-top navy 2px
  page.drawRectangle({
    x: 0,
    y: FOOTER_H,
    width: PAGE_W,
    height: 2,
    color: COR_NAVY,
  });
  // Fundo navy
  page.drawRectangle({
    x: 0,
    y: footerY,
    width: PAGE_W,
    height: FOOTER_H,
    color: COR_NAVY,
  });

  const size = 7.5;
  const ty = FOOTER_H / 2 - size / 2 + 1;

  // Esquerda: empresa + CNPJ
  const leftParts: string[] = [];
  if (e.nome) leftParts.push(safeText(e.nome));
  if (e.cnpj) leftParts.push(`CNPJ ${safeText(e.cnpj)}`);
  const left = leftParts.join(" • ") || safeText(e.razaoSocial || "");
  if (left) {
    page.drawText(left, {
      x: MARGIN_X,
      y: ty,
      size,
      font,
      color: COR_FOOTER_TXT,
    });
  }

  // Centro: nome + número do documento
  const centerParts: string[] = [];
  if (meta.titulo) centerParts.push(safeText(meta.titulo));
  if (meta.codigo) centerParts.push(safeText(meta.codigo));
  const center = centerParts.join(" — ");
  if (center) {
    const cw = font.widthOfTextAtSize(center, size);
    page.drawText(center, {
      x: (PAGE_W - cw) / 2,
      y: ty,
      size,
      font,
      color: COR_FOOTER_TXT,
    });
  }

  // Direita: paginação
  const right = `Página ${pageNum} de ${totalPages}`;
  const rw = font.widthOfTextAtSize(right, size);
  page.drawText(right, {
    x: PAGE_W - MARGIN_X - rw,
    y: ty,
    size,
    font,
    color: COR_FOOTER_TXT,
  });
}

// ============================================================
// Quebra de página
// ============================================================

function ensureSpace(ctx: Ctx, needed: number) {
  if (ctx.y - needed < MARGIN_BOTTOM) {
    newPage(ctx);
  }
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.pdf.addPage([PAGE_W, PAGE_H]);
  ctx.pageNum++;
  drawHeader(ctx);
  ctx.y = PAGE_H - MARGIN_TOP;
}

// ============================================================
// Componentes
// ============================================================

function drawSectionTitle(ctx: Ctx, numero: string, titulo: string) {
  ensureSpace(ctx, 30);
  const size = 10;
  const text = safeText(`${numero} — ${titulo}`).toUpperCase();
  const barH = size + 4;
  const barW = 3;
  const barX = MARGIN_X;
  const barY = ctx.y - barH;

  // Barra vertical azul
  ctx.page.drawRectangle({
    x: barX,
    y: barY,
    width: barW,
    height: barH,
    color: COR_AZUL,
  });
  ctx.page.drawText(text, {
    x: barX + barW + 8,
    y: barY + 2,
    size,
    font: ctx.fontBold,
    color: COR_TITULO,
  });
  ctx.y -= barH + 8;
}

function drawSubTitle(ctx: Ctx, numero: string, titulo: string) {
  ensureSpace(ctx, 22);
  const size = 8.5;
  const text = safeText(`${numero} ${titulo}`);
  ctx.page.drawText(text, {
    x: MARGIN_X,
    y: ctx.y - size - 2,
    size,
    font: ctx.fontBold,
    color: COR_MUTED,
  });
  ctx.y -= size + 8;
}

/** Tabela rótulo|valor — label cinza claro, valor branco, bordas suaves */
function drawCamposTable(
  ctx: Ctx,
  rows: { label: string; value: string }[],
) {
  if (!rows.length) return;
  const labelW = CONTENT_W * 0.38;
  const valueW = CONTENT_W - labelW;
  const padX = 8;
  const padY = 6;
  const size = 9;

  // Calcula altura total + altura de cada linha
  const heights: number[] = [];
  let totalH = 0;
  for (const r of rows) {
    const labelLines = wrapText(safeText(r.label), ctx.fontBold, size, labelW - padX * 2);
    const valueLines = wrapText(
      r.value && r.value.trim() ? safeText(r.value) : "—",
      ctx.font,
      size,
      valueW - padX * 2,
    );
    const lineH = size + 3;
    const rowH = Math.max(labelLines.length, valueLines.length, 1) * lineH + padY * 2;
    heights.push(rowH);
    totalH += rowH;
  }

  // Se não couber inteira, deixamos o ensureSpace por linha (quebra natural)
  // Mas para a estética da tabela, tentamos primeiro
  if (ctx.y - totalH < MARGIN_BOTTOM) {
    // tentamos nova página
    newPage(ctx);
  }

  const startY = ctx.y;
  // Cor de fundo da coluna de label (todas as linhas)
  // Desenharemos por linha para garantir as bordas internas

  let cursorY = startY;
  rows.forEach((r, idx) => {
    const rowH = heights[idx];
    if (cursorY - rowH < MARGIN_BOTTOM) {
      newPage(ctx);
      cursorY = ctx.y;
    }
    const labelLines = wrapText(safeText(r.label), ctx.fontBold, size, labelW - padX * 2);
    const rawValue = r.value && r.value.trim() ? safeText(r.value) : "—";
    const isEmpty = rawValue === "—";
    const valueLines = wrapText(rawValue, ctx.font, size, valueW - padX * 2);
    const lineH = size + 3;

    // Fundo label
    ctx.page.drawRectangle({
      x: MARGIN_X,
      y: cursorY - rowH,
      width: labelW,
      height: rowH,
      color: COR_LABEL_BG,
    });
    // Fundo valor (branco — opcional, mantém clean)
    // Separador horizontal entre linhas (#f3f4f6)
    if (idx < rows.length - 1) {
      ctx.page.drawLine({
        start: { x: MARGIN_X + 0.5, y: cursorY - rowH },
        end: { x: MARGIN_X + CONTENT_W - 0.5, y: cursorY - rowH },
        thickness: 0.5,
        color: COR_BORDA_SOFT,
      });
    }
    // Separador vertical entre cols
    ctx.page.drawLine({
      start: { x: MARGIN_X + labelW, y: cursorY },
      end: { x: MARGIN_X + labelW, y: cursorY - rowH },
      thickness: 0.5,
      color: COR_BORDA,
    });

    // Texto label
    let ly = cursorY - padY - size + 1;
    for (const line of labelLines) {
      ctx.page.drawText(line, {
        x: MARGIN_X + padX,
        y: ly,
        size,
        font: ctx.fontBold,
        color: COR_LABEL_TXT,
      });
      ly -= lineH;
    }
    // Texto valor
    ly = cursorY - padY - size + 1;
    for (const line of valueLines) {
      ctx.page.drawText(line, {
        x: MARGIN_X + labelW + padX,
        y: ly,
        size,
        font: ctx.font,
        color: isEmpty ? COR_PLACEHOLDER : COR_VALUE_TXT,
      });
      ly -= lineH;
    }

    cursorY -= rowH;
  });

  // Borda externa da tabela
  ctx.page.drawRectangle({
    x: MARGIN_X,
    y: cursorY,
    width: CONTENT_W,
    height: startY - cursorY,
    borderColor: COR_BORDA,
    borderWidth: 0.8,
    color: undefined,
  });

  ctx.y = cursorY - 10;
}

/** Grid 2 colunas de fotos com legenda */
function drawFotosGrid(
  ctx: Ctx,
  items: { legenda: string; foto?: { embed: any; w: number; h: number }; selo?: string }[],
) {
  const colW = (CONTENT_W - 10) / 2;
  const photoH = 150;
  const captionH = 22;
  const cellH = photoH + captionH;

  for (let i = 0; i < items.length; i += 2) {
    const pair = items.slice(i, i + 2);
    ensureSpace(ctx, cellH + 8);
    pair.forEach((it, idx) => {
      const x = MARGIN_X + idx * (colW + 10);
      const y = ctx.y - cellH;

      // Borda tracejada arredondada (cantos retos por limitação do pdf-lib)
      drawDashedRect(ctx.page, x, y, colW, cellH, COR_DASHED);

      // Legenda no topo (itálico cinza)
      const legenda = safeText(it.legenda || "");
      const capSize = 8.5;
      const capLines = wrapText(legenda, ctx.fontItalic, capSize, colW - 16).slice(0, 1);
      const capLine = capLines[0] || "";
      const capW = ctx.fontItalic.widthOfTextAtSize(capLine, capSize);
      ctx.page.drawText(capLine, {
        x: x + (colW - capW) / 2,
        y: y + cellH - capSize - 6,
        size: capSize,
        font: ctx.fontItalic,
        color: COR_MUTED,
      });

      // Foto ou placeholder
      if (it.foto) {
        const maxW = colW - 16;
        const maxH = photoH - 8;
        const scale = Math.min(maxW / it.foto.w, maxH / it.foto.h);
        const fw = it.foto.w * scale;
        const fh = it.foto.h * scale;
        ctx.page.drawImage(it.foto.embed, {
          x: x + (colW - fw) / 2,
          y: y + (photoH - fh) / 2,
          width: fw,
          height: fh,
        });
      } else {
        const msg = "Sem foto enviada";
        const s = 9;
        const w = ctx.fontItalic.widthOfTextAtSize(msg, s);
        ctx.page.drawText(msg, {
          x: x + (colW - w) / 2,
          y: y + photoH / 2 - s / 2,
          size: s,
          font: ctx.fontItalic,
          color: COR_PLACEHOLDER,
        });
      }

      // Selo IA
      if (it.selo) {
        const s = 7;
        const sw = ctx.fontBold.widthOfTextAtSize(it.selo, s);
        const padding = 4;
        const bx = x + colW - sw - padding * 2 - 6;
        const by = y + 6;
        ctx.page.drawRectangle({
          x: bx,
          y: by,
          width: sw + padding * 2,
          height: s + padding,
          color: COR_AZUL,
        });
        ctx.page.drawText(it.selo, {
          x: bx + padding,
          y: by + padding / 2,
          size: s,
          font: ctx.fontBold,
          color: COR_WHITE,
        });
      }
    });
    ctx.y -= cellH + 10;
  }
}

function drawAudioBloco(ctx: Ctx, titulo: string, transcricao: string | null) {
  const size = 9;
  const tituloLines = wrapText(safeText(titulo), ctx.fontBold, size, CONTENT_W - 16);
  const transc = transcricao?.trim() || "(sem transcrição)";
  const transcLines = wrapText(safeText(transc), ctx.fontItalic, size, CONTENT_W - 16);
  const lineH = size + 3;
  const h = (tituloLines.length + transcLines.length) * lineH + 14;
  ensureSpace(ctx, h + 6);
  ctx.page.drawRectangle({
    x: MARGIN_X,
    y: ctx.y - h,
    width: CONTENT_W,
    height: h,
    borderColor: COR_BORDA,
    borderWidth: 0.8,
    color: COR_LABEL_BG,
  });
  let yy = ctx.y - 8 - size;
  for (const line of tituloLines) {
    ctx.page.drawText(line, {
      x: MARGIN_X + 8,
      y: yy,
      size,
      font: ctx.fontBold,
      color: COR_LABEL_TXT,
    });
    yy -= lineH;
  }
  for (const line of transcLines) {
    ctx.page.drawText(line, {
      x: MARGIN_X + 8,
      y: yy,
      size,
      font: ctx.fontItalic,
      color: COR_VALUE_TXT,
    });
    yy -= lineH;
  }
  ctx.y -= h + 8;
}

function drawIdentificacao(ctx: Ctx, ident: PdfIdentificacao) {
  drawCamposTable(ctx, [
    {
      label: "Cliente / Unidade",
      value: `${ident.cliente}${ident.unidade ? " — " + ident.unidade : ""}`,
    },
    { label: "Data", value: ident.data },
    { label: "Responsável", value: ident.responsavel },
    { label: "Contato", value: ident.contato },
  ]);
}

// ============================================================
// Resposta → string
// ============================================================

const FIELD_TYPES = new Set([
  "texto",
  "numero",
  "data",
  "selecao_unica",
  "toggle",
  "checkbox",
  "cnpj",
  "cep",
]);

function respostaToString(p: PdfPergunta, r: PdfResposta | undefined): string {
  if (!r) return "";
  if (p.tipo === "toggle") {
    if (r.valor_texto === "sim") return "[X] Sim    [ ] Nao";
    if (r.valor_texto === "nao") return "[ ] Sim    [X] Nao";
    return "";
  }
  if (p.tipo === "checkbox") {
    return r.valor_texto === "true" ? "[X] Confirmado" : "[ ] Nao confirmado";
  }
  if (p.tipo === "selecao_unica" && r.valor_texto && p.opcoes?.length) {
    const opt = p.opcoes.find((o) => o.id === r.valor_texto);
    return opt?.texto ?? r.valor_texto;
  }
  if (p.tipo === "data" && r.valor_texto) {
    return formatDate(r.valor_texto);
  }
  return r.valor_texto ?? "";
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

// ============================================================
// Build
// ============================================================

export async function buildMapeamentoPdf(input: PdfBuildInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const logoImg = await loadLogo(pdf, input.meta);

  const ctx: Ctx = {
    pdf,
    page: pdf.addPage([PAGE_W, PAGE_H]),
    font,
    fontBold,
    fontItalic,
    y: PAGE_H - MARGIN_TOP,
    meta: input.meta,
    logoImg,
    pageNum: 1,
  };
  drawHeader(ctx);

  // Bloco de identificação
  drawSectionTitle(ctx, "0", "Identificação");
  drawIdentificacao(ctx, input.identificacao);

  const fotoCache = new Map<string, { embed: any; w: number; h: number } | null>();
  async function getFoto(path: string) {
    if (fotoCache.has(path)) return fotoCache.get(path) ?? null;
    const f = input.fotos.get(path);
    if (!f) {
      fotoCache.set(path, null);
      return null;
    }
    try {
      const isPng = f.mime.toLowerCase().includes("png");
      const embed = isPng ? await pdf.embedPng(f.bytes) : await pdf.embedJpg(f.bytes);
      const entry = { embed, w: embed.width, h: embed.height };
      fotoCache.set(path, entry);
      return entry;
    } catch {
      fotoCache.set(path, null);
      return null;
    }
  }

  // Seções
  let secIdx = 1;
  for (const sec of input.secoes) {
    drawSectionTitle(ctx, String(secIdx), sec.titulo);
    if (sec.descricao) {
      const lines = wrapText(safeText(sec.descricao), ctx.font, 9, CONTENT_W);
      const h = lines.length * 12 + 6;
      ensureSpace(ctx, h);
      for (const l of lines) {
        ctx.page.drawText(l, {
          x: MARGIN_X,
          y: ctx.y - 10,
          size: 9,
          font: ctx.font,
          color: COR_MUTED,
        });
        ctx.y -= 12;
      }
      ctx.y -= 4;
    }

    const perguntas = [...sec.perguntas].sort((a, b) => a.ordem - b.ordem);
    type Grupo = { tipo: "campos" | "fotos" | "audio"; items: PdfPergunta[] };
    const grupos: Grupo[] = [];
    for (const p of perguntas) {
      const cat: Grupo["tipo"] =
        p.tipo === "foto" ? "fotos" : p.tipo === "audio" ? "audio" : "campos";
      if (!FIELD_TYPES.has(p.tipo) && cat === "campos") {
        // tipo desconhecido — trata como campo
      }
      const last = grupos[grupos.length - 1];
      if (last && last.tipo === cat) last.items.push(p);
      else grupos.push({ tipo: cat, items: [p] });
    }

    let subIdx = 1;
    for (const g of grupos) {
      if (g.tipo === "campos") {
        drawCamposTable(
          ctx,
          g.items.map((p) => ({
            label: p.texto,
            value: respostaToString(p, input.respostas.get(p.id)),
          })),
        );
      } else if (g.tipo === "fotos") {
        drawSubTitle(ctx, `${secIdx}.${subIdx++}`, "Registro fotográfico");
        const items = await Promise.all(
          g.items.map(async (p) => {
            const r = input.respostas.get(p.id);
            const foto = r?.arquivo_path ? await getFoto(r.arquivo_path) : null;
            const selo =
              r?.ia_aprovado === true ? "IA OK" : r?.ia_aprovado === false ? "IA REVISAR" : undefined;
            return {
              legenda: p.instrucao_agente || p.texto,
              foto: foto ?? undefined,
              selo,
            };
          }),
        );
        drawFotosGrid(ctx, items);
      } else {
        for (const p of g.items) {
          const r = input.respostas.get(p.id);
          drawAudioBloco(ctx, p.texto, r?.transcricao ?? null);
        }
      }
    }
    secIdx++;
  }

  // Footers
  const total = ctx.pdf.getPageCount();
  for (let i = 0; i < total; i++) {
    const pg = ctx.pdf.getPage(i);
    drawFooter(
      {
        ...ctx,
        page: pg,
        pageNum: i + 1,
      },
      total,
    );
  }

  return await pdf.save();
}
