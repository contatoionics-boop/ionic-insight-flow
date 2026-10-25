import { describe, expect, it } from "vitest";
import {
  anguloDoGiro,
  anotacaoVazia,
  cantoNumero,
  clamp,
  ladoPorArraste,
  anotacaoDoItem,
  moverPontos,
  numeracaoDosItens,
  ordemDeDesenho,
  proximoZ,
  novaAnotacao,
  novaPeca,
  primitivasDaAnotacao,
  quebrarTexto,
  tamanhoInicial,
} from "./geometria";
import { BIBLIOTECA, GRUPOS_BIBLIOTECA, PECAS } from "./biblioteca";

describe("tamanhoInicial", () => {
  it("peça comum: altura de 26% e largura pela proporção", () => {
    const t = tamanhoInicial(0.5, 1.5);
    expect(t.h).toBeCloseTo(0.26);
    expect(t.w).toBeCloseTo((0.5 * 0.26) / 1.5);
  });
  it("peça muito larga (ilha) fica mais baixa", () => {
    const t = tamanhoInicial(7.227, 1.5);
    expect(t.h).toBeCloseTo(0.11);
    expect(t.w).toBeCloseTo((7.227 * 0.11) / 1.5);
  });
  it("peça com altura própria não nasce mais larga que 45% da foto", () => {
    const t = tamanhoInicial(1.68, 0.5625, 0.34);
    expect(t.w).toBeCloseTo(0.45);
    expect(t.h).toBeCloseTo(0.45 / 1.68 * 0.5625);
    expect(tamanhoInicial(1, 1.5, 0.14)).toMatchObject({ h: 0.14 });
  });
  it("proporção da foto zerada não quebra", () => {
    expect(Number.isFinite(tamanhoInicial(1, 0).w)).toBe(true);
  });
});

describe("novaPeca", () => {
  it("o clique marca a base: o centro sobe meia altura e fica dentro da foto", () => {
    const p = novaPeca("a", "totemT1000", 0.472, 1.5, { x: 0.4, y: 0.9 });
    expect(p.cx).toBeCloseTo(0.4);
    expect(p.cy).toBeCloseTo(0.9 - p.h / 2);
    expect(novaPeca("b", "ilha", 7, 1.5, { x: 2, y: -1 })).toMatchObject({ cx: 1, cy: 0 });
  });
});

describe("cantoNumero", () => {
  const item = { id: "i", tipo: "peca" as const, pecaId: "x", cx: 0.5, cy: 0.5, w: 0.2, h: 0.2, rot: 0, nota: "" };
  it("sem giro: canto superior direito", () => {
    const c = cantoNumero(item, 1000, 500);
    expect(c.x).toBeCloseTo(600);
    expect(c.y).toBeCloseTo(200);
  });
  it("girada 90°: o canto acompanha o giro", () => {
    const c = cantoNumero({ ...item, rot: 90 }, 1000, 1000);
    expect(c.x).toBeCloseTo(600);
    expect(c.y).toBeCloseTo(600);
  });
});

describe("giro e arraste", () => {
  it("ponteiro acima do centro = 0°; à direita = 90°", () => {
    expect(anguloDoGiro({ x: 0, y: 0 }, { x: 0, y: -10 })).toBeCloseTo(0);
    expect(anguloDoGiro({ x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(90);
  });
  it("ímã de 15°", () => {
    expect(anguloDoGiro({ x: 0, y: 0 }, { x: 10, y: -2 }, true) % 15).toBeCloseTo(0);
  });
  it("arraste de lado respeita os limites", () => {
    expect(ladoPorArraste(0.5, 0.6, 0.03, 1.9)).toBeCloseTo(0.2);
    expect(ladoPorArraste(0.5, 0.5, 0.03, 1.9)).toBeCloseTo(0.03);
    expect(clamp(5, 0, 1)).toBe(1);
  });
});

describe("quebrarTexto", () => {
  const medir = (t: string) => t.length * 10;
  it("quebra por largura", () => {
    expect(quebrarTexto(medir, "uma frase para quebrar", 100)).toEqual(["uma frase", "para", "quebrar"]);
  });
  it("texto vazio devolve uma linha vazia", () => {
    expect(quebrarTexto(medir, "", 100)).toEqual([""]);
  });
});

describe("biblioteca", () => {
  it("tem as 34 peças, em grupos e com arquivo", () => {
    expect(BIBLIOTECA).toHaveLength(34);
    expect(GRUPOS_BIBLIOTECA).toHaveLength(9);
    expect(new Set(BIBLIOTECA.map((p) => p.id)).size).toBe(34);
    expect(PECAS.totemT1000.completo).toMatch(/T1000/);
    expect(BIBLIOTECA.every((p) => p.arquivo && p.proporcao > 0)).toBe(true);
  });
});

describe("anotações", () => {
  const medir = (t: string, tam: number) => t.length * tam * 0.5;

  it("balão nasce com alvo e balão afastado, dentro da foto", () => {
    const a = novaAnotacao("a", "balao", { x: 0.9, y: 0.05 });
    expect(a.pts).toHaveLength(2);
    expect(a.pts[1].x).toBeLessThan(a.pts[0].x);
    expect(a.pts.every((p) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)).toBe(true);
  });
  it("texto tem 1 ponto; cota/seta nascem com início = fim", () => {
    expect(novaAnotacao("t", "texto", { x: 0.3, y: 0.3 }).pts).toHaveLength(1);
    const c = novaAnotacao("c", "cota", { x: 0.3, y: 0.3 });
    expect(c.pts[0]).toEqual(c.pts[1]);
    expect(anotacaoVazia(c)).toBe(true);
    expect(anotacaoVazia({ ...c, pts: [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.1 }] })).toBe(false);
    expect(anotacaoVazia(novaAnotacao("b", "balao", { x: 0.3, y: 0.3 }))).toBe(false);
  });
  it("mover pontos respeita as bordas da foto", () => {
    const r = moverPontos([{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.2 }], 2, -2);
    expect(r[1].x).toBeCloseTo(1);
    expect(r[0].y).toBeCloseTo(0);
    expect(r[1].x - r[0].x).toBeCloseTo(0.4);
  });
  it("cota: linha, duas pontas e etiqueta com a medida", () => {
    const a = { ...novaAnotacao("c", "cota", { x: 0.1, y: 0.5 }), pts: [{ x: 0.1, y: 0.5 }, { x: 0.5, y: 0.5 }], texto: "1,20 m" };
    const prims = primitivasDaAnotacao(a, 1000, 500, medir);
    expect(prims.filter((p) => p.k === "linha")).toHaveLength(3);
    const et = prims.find((p) => p.k === "etiqueta");
    expect(et).toMatchObject({ linhas: ["1,20 m"], cx: 300, cy: 250 });
  });
  it("seta: haste + duas asas; linha: uma linha grossa", () => {
    const seta = { ...novaAnotacao("s", "seta", { x: 0.1, y: 0.1 }), pts: [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.4 }] };
    expect(primitivasDaAnotacao(seta, 1000, 1000, medir).filter((p) => p.k === "linha")).toHaveLength(3);
    const linha = { ...seta, tipo: "linha" as const };
    const [l] = primitivasDaAnotacao(linha, 1000, 1000, medir);
    expect(l).toMatchObject({ k: "linha", lw: expect.any(Number) });
  });
  it("sem texto: nada é desenhado no balão/texto, a não ser o marcador de edição", () => {
    const t = novaAnotacao("t", "texto", { x: 0.5, y: 0.5 });
    expect(primitivasDaAnotacao(t, 1000, 500, medir)).toHaveLength(0);
    expect(primitivasDaAnotacao(t, 1000, 500, medir, { vazio: "Texto…" })).toHaveLength(1);
  });
  it("caixa: retângulo tracejado normalizado", () => {
    const c = { ...novaAnotacao("x", "caixa", { x: 0.6, y: 0.6 }), pts: [{ x: 0.6, y: 0.6 }, { x: 0.2, y: 0.3 }] };
    const [r] = primitivasDaAnotacao(c, 1000, 1000, medir);
    expect(r).toMatchObject({ k: "rect", x: 200, y: 300, w: 400, h: 300, tracejado: true });
  });

  it("texto longo do balão quebra em linhas e a caixa fica dentro da foto", () => {
    const a = {
      ...novaAnotacao("b", "balao", { x: 0.5, y: 0.5 }),
      pts: [{ x: 0.5, y: 0.6 }, { x: 0.02, y: 0.02 }],
      texto: "aqui vai o texto que pode ser bem grande e precisa quebrar em varias linhas",
    };
    const et = primitivasDaAnotacao(a, 1000, 500, medir).find((p) => p.k === "etiqueta") as any;
    expect(et.linhas.length).toBeGreaterThan(1);
    expect(et.w).toBeLessThanOrEqual(1000 * 0.28 + 40);
    expect(et.cx - et.w / 2).toBeGreaterThanOrEqual(0);
    expect(et.cy - et.h / 2).toBeGreaterThanOrEqual(0);
  });
});

describe("item em modo balão e ordem de empilhamento", () => {
  const mk = (id: string, extra: Record<string, unknown> = {}) =>
    ({ id, tipo: "peca" as const, pecaId: "ilha", cx: 0.3, cy: 0.5, w: 0.2, h: 0.2, rot: 0, nota: "", ...extra });
  it("só os itens em modo número entram na numeração da legenda", () => {
    const m = numeracaoDosItens([mk("a"), mk("b", { modo: "balao" }), mk("c")]);
    expect([...m.entries()]).toEqual([["a", 1], ["c", 2]]);
  });
  it("ordem de empilhamento: z maior vai para a frente; empate segue a lista", () => {
    const itens = [mk("a"), mk("b", { z: 1 }), mk("c"), mk("d", { z: -1 })];
    expect(ordemDeDesenho(itens).map((i) => i.id)).toEqual(["d", "a", "c", "b"]);
    expect(proximoZ(itens, "frente")).toBe(2);
    expect(proximoZ(itens, "tras")).toBe(-2);
  });
  it("balão do item aponta para o centro da peça e respeita a posição salva", () => {
    const a = anotacaoDoItem(mk("a"), "Instalar aqui");
    expect(a).toMatchObject({ id: "b:a", tipo: "balao", texto: "Instalar aqui" });
    expect(a.pts[0]).toEqual({ x: 0.3, y: 0.5 });
    expect(anotacaoDoItem(mk("a", { bal: { x: 0.7, y: 0.2 } }), "x").pts[1]).toEqual({ x: 0.7, y: 0.2 });
  });
});
