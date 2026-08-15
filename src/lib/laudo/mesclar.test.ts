import { describe, expect, it } from "vitest";
import { dedupBlocos } from "./mesclar";
import type { BlocoLaudo } from "./tipos";

function par(id: string, chave: string | undefined, texto: string): BlocoLaudo {
  return { id, chave, tipo: "paragraph", texto } as unknown as BlocoLaudo;
}

describe("dedupBlocos", () => {
  it("remove repetição do mesmo id", () => {
    const out = dedupBlocos([par("b1", "k1", "A"), par("b1", "k1", "A")]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("b1");
  });

  it("remove repetição da mesma chave com ids diferentes", () => {
    const out = dedupBlocos([par("b1", "k1", "A"), par("b2", "k1", "B")]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("b1");
  });

  it("preserva blocos com conteúdo idêntico mas id e chave diferentes", () => {
    const out = dedupBlocos([par("b1", "k1", "Mesmo texto"), par("b2", "k2", "Mesmo texto")]);
    expect(out).toHaveLength(2);
    expect(out.map((b) => b.id)).toEqual(["b1", "b2"]);
  });

  it("preserva pagebreaks legítimos", () => {
    const pb = (id: string) => ({ id, chave: "pagebreak", tipo: "pagebreak" }) as unknown as BlocoLaudo;
    const out = dedupBlocos([par("b1", "k1", "A"), pb("p1"), par("b2", "k2", "B"), pb("p2")]);
    expect(out.filter((b) => b.tipo === "pagebreak")).toHaveLength(2);
    expect(out).toHaveLength(4);
  });
});
