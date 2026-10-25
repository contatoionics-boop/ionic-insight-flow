import { describe, expect, it } from "vitest";
import { mesclarDocumento } from "./mesclar";
import { renumerar, semPrefixoFigura } from "./numeracao";
import type { BlocoLaudo } from "./tipos";

const img = (id: string, extra: Record<string, unknown> = {}) =>
  ({ id, tipo: "image", url: `https://x/${id}.jpg`, alt: id, legenda: null, ...extra }) as unknown as BlocoLaudo;
const desenho = { versao: 1, foto: { largura: 10, altura: 10 }, itens: [] };
const legendas = (bs: BlocoLaudo[]) => bs.filter((b) => b.tipo === "image").map((b) => (b as any).legenda);

describe("renumeração de figuras", () => {
  it("desenho no meio empurra os números seguintes, sem repetir", () => {
    const r = renumerar([
      img("a", { legenda: "Figura 1 — Bico automatizado" }),
      img("d", { desenho, legenda: "Desenho técnico" }),
      img("b", { legenda: "Figura 2 — Ponteira" }),
    ]);
    expect(legendas(r)).toEqual(["Figura 1 — Bico automatizado", "Figura 2 — Desenho técnico", "Figura 3 — Ponteira"]);
  });
  it("vários desenhos são numerados na ordem; foto comum e imagem oculta ficam de fora", () => {
    const r = renumerar([
      img("f", { legenda: "Foto da bomba" }),
      img("d1", { desenho, legenda: "Pista 1" }),
      img("x", { desenho, legenda: "Figura 9 — escondida", oculto: true }),
      img("d2", { desenho, legenda: null }),
    ]);
    expect(legendas(r)).toEqual(["Foto da bomba", "Figura 1 — Pista 1", "Figura 9 — escondida", "Figura 2"]);
  });
  it("desenho sem imagem ainda não é numerado; renumerar é idempotente", () => {
    const vazio = img("v", { desenho, url: "", legenda: "x" });
    expect(renumerar([vazio])[0]).toBe(vazio);
    const uma = renumerar([img("d", { desenho, legenda: "Pista" })]);
    expect(renumerar(uma)[0]).toBe(uma[0]);
  });
  it("tira o prefixo da legenda", () => {
    expect(semPrefixoFigura("Figura 12 — Bico")).toBe("Bico");
    expect(semPrefixoFigura("Figura de bico")).toBe("Figura de bico");
  });
  it("títulos continuam numerados", () => {
    const h = { id: "h", tipo: "heading", numero: "", texto: "T", nivel: 1 } as unknown as BlocoLaudo;
    expect((renumerar([h, img("d", { desenho })])[0] as any).numero).toBe("1");
  });
});

describe("desenho técnico e 'Regerar rascunho'", () => {
  it("bloco manual com desenho sobrevive à mescla e a numeração acompanha", () => {
    const manual = img("d", { desenho, legenda: "Figura 1 — Pista", chave: "manual:abc", origem: "manual" });
    const salvos = [img("a", { legenda: "Figura 1 — Bico", chave: "image:bico", origem: "automatic" }), manual];
    const gerados = [img("a2", { legenda: "Figura 1 — Bico", chave: "image:bico" }), img("n", { legenda: "Figura 2 — Nova", chave: "image:nova" })];
    const r = mesclarDocumento(salvos, gerados);
    const d = r.blocos.find((b) => b.id === "d") as any;
    expect(d.desenho).toEqual(desenho);
    expect(d.url).toBe("https://x/d.jpg");
    expect(legendas(r.blocos)).toEqual(["Figura 1 — Bico", "Figura 2 — Nova", "Figura 3 — Pista"]);
    expect(r.manuais).toBe(1);
  });
});
