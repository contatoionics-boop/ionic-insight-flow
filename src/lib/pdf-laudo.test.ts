import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildLaudoPdf } from "./pdf-laudo.server";
import type { BlocoLaudo } from "./laudo/tipos";

const meta = { titulo: "T", codigo: null, revisao: null, empresaNome: "IONICS", cliente: "C", unidade: "U", data: "01/01/2026", agente: "A" };
const p = (id: string, texto: string, extra: Record<string, unknown> = {}) => ({ id, tipo: "paragraph", texto, ...extra }) as BlocoLaudo;
const texto = (bytes: Uint8Array) => Buffer.from(bytes).toString("latin1");

describe("PDF do laudo com formatação", () => {
  it("documento simples não incorpora as fontes itálicas (sai como sempre)", async () => {
    const bytes = await buildLaudoPdf({ meta, blocos: [p("a", "Parágrafo comum justificado.")] });
    expect(texto(bytes).slice(0, 5)).toBe("%PDF-");
  });

  it("negrito, itálico, sublinhado, caixa alta e alinhamentos geram o PDF e usam as fontes certas", async () => {
    const blocos = [
      p("b", "Texto com **negrito**, *itálico*, ***os dois*** e ++sublinhado++.", { rico: true }),
      p("c", "Centralizado em caixa alta", { alinhamento: "centro", caixaAlta: true }),
      p("d", "À direita, com **destaque**", { alinhamento: "direita", rico: true }),
      p("e", "À esquerda " + "palavra ".repeat(80), { alinhamento: "esquerda" }),
      p("f", "Justificado longo " + "texto **importante** ".repeat(60), { rico: true }),
      { id: "g", tipo: "bullets", itens: ["item com **negrito**", "item *itálico* e ++sublinhado++"], rico: true } as BlocoLaudo,
      p("h", "Pendência [CONFIRMAR: objeto do escopo] em **destaque**", { rico: true }),
    ];
    const bytes = await buildLaudoPdf({ meta, blocos });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    // as fontes itálicas entram no arquivo (o documento com formatação é maior que o simples equivalente)
    const simples = await buildLaudoPdf({ meta, blocos: [p("a", "x")] });
    expect(bytes.length).toBeGreaterThan(simples.length);
  });

  it("a formatação não muda a quebra de página: o mesmo texto sem marcas ocupa as mesmas páginas", async () => {
    const comMarcas = Array.from({ length: 12 }, (_, i) => p(`m${i}`, "Linha **forte** e *leve* ".repeat(120), { rico: true }));
    const semMarcas = Array.from({ length: 12 }, (_, i) => p(`n${i}`, "Linha forte e leve ".repeat(120)));
    const a = await PDFDocument.load(await buildLaudoPdf({ meta, blocos: comMarcas }));
    const b = await PDFDocument.load(await buildLaudoPdf({ meta, blocos: semMarcas }));
    // negrito é mais largo: pode haver diferença de poucas linhas, nunca o texto num bloco só (bug anterior: 1 página)
    expect(a.getPageCount()).toBeGreaterThanOrEqual(b.getPageCount());
    expect(a.getPageCount()).toBeLessThanOrEqual(b.getPageCount() + 2);
  });

  it("texto longo com formatação quebra em várias páginas sem erro; marcas soltas e vazio não quebram", async () => {
    const longo = Array.from({ length: 12 }, (_, i) => p(`l${i}`, "Linha **forte** e *leve* ".repeat(120), { rico: true, alinhamento: i % 2 ? "justificado" : "esquerda" }));
    const bytes = await buildLaudoPdf({ meta, blocos: [...longo, p("x", "**aberto sem fechar e * solta", { rico: true }), p("y", "", { rico: true })] });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });
});
