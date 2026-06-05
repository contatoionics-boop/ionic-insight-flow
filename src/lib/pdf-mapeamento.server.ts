/**
 * Servidor-only: monta o PDF do mapeamento técnico usando pdf-lib (puro JS).
 * Roda no Cloudflare Worker (sem deps nativas).
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

export type PdfMeta = {
  /** Texto do título principal — vem do nome do formulário */
  titulo: string;
  /** Código do documento (ex: FR-29-10) */
  codigo: string | null;
  revisao: string | null;
  dataRevisao: string | null;
  elaboradoPor: string | null;
  aprovadoPor: string | null;
  /** Logo da empresa Ionics — bytes opcionais */
  logoBytes?: Uint8Array | null;
  logoMime?: string | null;
  /** Nome da Ionics (configuracoes_empresa.nome_empresa) */
  nomeEmpresa: string;
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
// Cores / layout
// ============================================================
const COR_PRIMARIA: RGB = rgb(0.102, 0.235, 0.431); // azul Ionics
const COR_PRIMARIA_TXT: RGB = rgb(1, 1, 1);
const COR_BORDA: RGB = rgb(0.78, 0.81, 0.85);
const COR_TXT: RGB = rgb(0.05, 0.05, 0.1);
const COR_MUTED: RGB = rgb(0.4, 0.42, 0.48);

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN_X = 36;
const MARGIN_TOP = 90; // espaço pra header
const MARGIN_BOTTOM = 50; // espaço pra footer
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
  // pdf-lib (StandardFonts) só aceita WinAnsi — caracteres fora viram '?'.
  // Substitui graceful: mantém acentuação latin-1.
  return s.replace(/[\u2010-\u2015]/g, "-").replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
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
    const targetH = 32;
    const scale = targetH / embed.height;
    return { embed, w: embed.width * scale, h: targetH };
  } catch {
    return null;
  }
}

function drawHeader(ctx: Ctx) {
  const { page, font, fontBold, meta, logoImg } = ctx;
  // Faixa azul de cabeçalho
  page.drawRectangle({
    x: 0,
    y: PAGE_H - 70,
    width: PAGE_W,
    height: 70,
    color: COR_PRIMARIA,
  });

  // Logo ou nome
  if (logoImg) {
    page.drawImage(logoImg.embed, {
      x: MARGIN_X,
      y: PAGE_H - 50,
      width: logoImg.w,
      height: logoImg.h,
    });
  } else {
    page.drawText(safeText(meta.nomeEmpresa), {
      x: MARGIN_X,
      y: PAGE_H - 42,
      size: 16,
      font: fontBold,
      color: COR_PRIMARIA_TXT,
    });
  }

  // Título (centralizado)
  const titulo = safeText(meta.titulo) || "MAPEAMENTO TÉCNICO";
  const tWidth = fontBold.widthOfTextAtSize(titulo, 12);
  page.drawText(titulo.toUpperCase(), {
    x: (PAGE_W - tWidth) / 2,
    y: PAGE_H - 42,
    size: 12,
    font: fontBold,
    color: COR_PRIMARIA_TXT,
  });

  // Código (direita)
  if (meta.codigo) {
    const code = safeText(meta.codigo);
    page.drawText("Código", {
      x: PAGE_W - MARGIN_X - 70,
      y: PAGE_H - 30,
      size: 8,
      font,
      color: COR_PRIMARIA_TXT,
    });
    page.drawText(code, {
      x: PAGE_W - MARGIN_X - 70,
      y: PAGE_H - 46,
      size: 11,
      font: fontBold,
      color: COR_PRIMARIA_TXT,
    });
  }
}

function drawFooter(ctx: Ctx, totalPages?: number) {
  const { page, font, meta, pageNum } = ctx;
  const y = 30;
  // linha
  page.drawLine({
    start: { x: MARGIN_X, y: y + 18 },
    end: { x: PAGE_W - MARGIN_X, y: y + 18 },
    thickness: 0.5,
    color: COR_BORDA,
  });
  const parts: string[] = [];
  if (meta.elaboradoPor) parts.push(`Elaborado: ${meta.elaboradoPor}`);
  if (meta.aprovadoPor) parts.push(`Aprovado: ${meta.aprovadoPor}`);
  if (meta.revisao) parts.push(`Rev. ${meta.revisao}`);
  if (meta.dataRevisao) parts.push(`Data: ${formatDate(meta.dataRevisao)}`);
  const left = safeText(parts.join("  ·  "));
  page.drawText(left, { x: MARGIN_X, y, size: 7.5, font, color: COR_MUTED });

  const right = totalPages ? `Página ${pageNum} de ${totalPages}` : `Página ${pageNum}`;
  const w = font.widthOfTextAtSize(right, 7.5);
  page.drawText(right, { x: PAGE_W - MARGIN_X - w, y, size: 7.5, font, color: COR_MUTED });
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
  ensureSpace(ctx, 36);
  const h = 22;
  ctx.page.drawRectangle({
    x: MARGIN_X,
    y: ctx.y - h,
    width: CONTENT_W,
    height: h,
    color: COR_PRIMARIA,
  });
  ctx.page.drawText(safeText(`${numero} - ${titulo}`), {
    x: MARGIN_X + 8,
    y: ctx.y - 15,
    size: 11,
    font: ctx.fontBold,
    color: COR_PRIMARIA_TXT,
  });
  ctx.y -= h + 8;
}

function drawSubTitle(ctx: Ctx, numero: string, titulo: string) {
  ensureSpace(ctx, 28);
  const h = 18;
  ctx.page.drawRectangle({
    x: MARGIN_X,
    y: ctx.y - h,
    width: CONTENT_W,
    height: h,
    color: rgb(0.92, 0.94, 0.98),
    borderColor: COR_PRIMARIA,
    borderWidth: 0.5,
  });
  ctx.page.drawText(safeText(`${numero} - ${titulo}`), {
    x: MARGIN_X + 8,
    y: ctx.y - 13,
    size: 9.5,
    font: ctx.fontBold,
    color: COR_PRIMARIA,
  });
  ctx.y -= h + 6;
}

/** Tabela rótulo|valor */
function drawCamposTable(
  ctx: Ctx,
  rows: { label: string; value: string }[],
) {
  const labelW = CONTENT_W * 0.42;
  const valueW = CONTENT_W - labelW;
  const padX = 6;
  const padY = 4;
  const size = 9;

  for (const r of rows) {
    const labelLines = wrapText(safeText(r.label), ctx.fontBold, size, labelW - padX * 2);
    const valueLines = wrapText(safeText(r.value || "—"), ctx.font, size, valueW - padX * 2);
    const lineH = size + 3;
    const rowH = Math.max(labelLines.length, valueLines.length, 1) * lineH + padY * 2;

    ensureSpace(ctx, rowH);

    // Coluna esquerda (azul)
    ctx.page.drawRectangle({
      x: MARGIN_X,
      y: ctx.y - rowH,
      width: labelW,
      height: rowH,
      color: COR_PRIMARIA,
      borderColor: COR_BORDA,
      borderWidth: 0.5,
    });
    // Coluna direita (branca)
    ctx.page.drawRectangle({
      x: MARGIN_X + labelW,
      y: ctx.y - rowH,
      width: valueW,
      height: rowH,
      color: rgb(1, 1, 1),
      borderColor: COR_BORDA,
      borderWidth: 0.5,
    });

    let ly = ctx.y - padY - size;
    for (const line of labelLines) {
      ctx.page.drawText(line, {
        x: MARGIN_X + padX,
        y: ly,
        size,
        font: ctx.fontBold,
        color: COR_PRIMARIA_TXT,
      });
      ly -= lineH;
    }
    ly = ctx.y - padY - size;
    for (const line of valueLines) {
      ctx.page.drawText(line, {
        x: MARGIN_X + labelW + padX,
        y: ly,
        size,
        font: ctx.font,
        color: COR_TXT,
      });
      ly -= lineH;
    }
    ctx.y -= rowH;
  }
  ctx.y -= 8;
}

/** Grid 2 colunas de fotos com legenda */
function drawFotosGrid(
  ctx: Ctx,
  items: { legenda: string; foto?: { embed: any; w: number; h: number }; selo?: string }[],
) {
  const colW = (CONTENT_W - 8) / 2;
  const photoH = 150;
  const captionLines = 4;
  const lineH = 11;
  const cellH = photoH + captionLines * lineH + 18;

  for (let i = 0; i < items.length; i += 2) {
    const pair = items.slice(i, i + 2);
    ensureSpace(ctx, cellH);
    pair.forEach((it, idx) => {
      const x = MARGIN_X + idx * (colW + 8);
      // Caixa
      ctx.page.drawRectangle({
        x,
        y: ctx.y - cellH,
        width: colW,
        height: cellH,
        borderColor: COR_BORDA,
        borderWidth: 0.5,
        color: rgb(1, 1, 1),
      });
      // Legenda no topo
      const capLines = wrapText(safeText(it.legenda), ctx.font, 8, colW - 12).slice(
        0,
        captionLines,
      );
      let cy = ctx.y - 12;
      for (const line of capLines) {
        ctx.page.drawText(line, {
          x: x + 6,
          y: cy,
          size: 8,
          font: ctx.fontItalic,
          color: COR_MUTED,
        });
        cy -= lineH;
      }
      // Foto
      if (it.foto) {
        const maxW = colW - 12;
        const scale = Math.min(maxW / it.foto.w, photoH / it.foto.h);
        const fw = it.foto.w * scale;
        const fh = it.foto.h * scale;
        ctx.page.drawImage(it.foto.embed, {
          x: x + (colW - fw) / 2,
          y: ctx.y - cellH + 14,
          width: fw,
          height: fh,
        });
      } else {
        const msg = "Sem foto enviada";
        const w = ctx.fontItalic.widthOfTextAtSize(msg, 9);
        ctx.page.drawText(msg, {
          x: x + (colW - w) / 2,
          y: ctx.y - cellH + photoH / 2,
          size: 9,
          font: ctx.fontItalic,
          color: COR_MUTED,
        });
      }
      // Selo IA
      if (it.selo) {
        const sw = ctx.fontBold.widthOfTextAtSize(it.selo, 7);
        ctx.page.drawRectangle({
          x: x + colW - sw - 12,
          y: ctx.y - cellH + 4,
          width: sw + 8,
          height: 12,
          color: rgb(0.2, 0.6, 0.3),
        });
        ctx.page.drawText(it.selo, {
          x: x + colW - sw - 8,
          y: ctx.y - cellH + 7,
          size: 7,
          font: ctx.fontBold,
          color: rgb(1, 1, 1),
        });
      }
    });
    ctx.y -= cellH + 8;
  }
}

function drawAudioBloco(ctx: Ctx, titulo: string, transcricao: string | null) {
  const size = 9;
  const tituloLines = wrapText(safeText(titulo), ctx.fontBold, size, CONTENT_W - 12);
  const transc = transcricao?.trim() || "(sem transcrição)";
  const transcLines = wrapText(safeText(transc), ctx.fontItalic, size, CONTENT_W - 12);
  const lineH = size + 3;
  const h = (tituloLines.length + transcLines.length) * lineH + 12;
  ensureSpace(ctx, h);
  ctx.page.drawRectangle({
    x: MARGIN_X,
    y: ctx.y - h,
    width: CONTENT_W,
    height: h,
    borderColor: COR_BORDA,
    borderWidth: 0.5,
    color: rgb(0.98, 0.98, 0.99),
  });
  let yy = ctx.y - 8 - size;
  for (const line of tituloLines) {
    ctx.page.drawText(line, { x: MARGIN_X + 6, y: yy, size, font: ctx.fontBold, color: COR_TXT });
    yy -= lineH;
  }
  for (const line of transcLines) {
    ctx.page.drawText(line, { x: MARGIN_X + 6, y: yy, size, font: ctx.fontItalic, color: COR_TXT });
    yy -= lineH;
  }
  ctx.y -= h + 6;
}

function drawIdentificacao(ctx: Ctx, ident: PdfIdentificacao) {
  drawCamposTable(ctx, [
    { label: "Cliente / Unidade", value: `${ident.cliente}${ident.unidade ? " — " + ident.unidade : ""}` },
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
    if (r.valor_texto === "sim") return "☑ Sim    ☐ Não";
    if (r.valor_texto === "nao") return "☐ Sim    ☑ Não";
    return "";
  }
  if (p.tipo === "checkbox") {
    return r.valor_texto === "true" ? "☑ Confirmado" : "☐ Não confirmado";
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

  // Pré-embed fotos (evita re-embed)
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

    // Agrupa perguntas consecutivas por categoria
    const perguntas = [...sec.perguntas].sort((a, b) => a.ordem - b.ordem);
    type Grupo = { tipo: "campos" | "fotos" | "audio"; items: PdfPergunta[] };
    const grupos: Grupo[] = [];
    for (const p of perguntas) {
      const cat: Grupo["tipo"] = p.tipo === "foto" ? "fotos" : p.tipo === "audio" ? "audio" : "campos";
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

  // Footers (total de páginas conhecido agora)
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
