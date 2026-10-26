import { describe, expect, it } from "vitest";
import { normalizarEscopo } from "@/lib/proposta/tipos";
import { estruturaDoEscopo, estruturaEhVazia } from "./sugerir";

const escopo = (campos: Record<string, unknown>) =>
  normalizarEscopo(Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, { valor: v, confianca: 1, origem: "escopo" }])));

describe("estruturaDoEscopo", () => {
  it("2 postos, 4 pistas, 8 bombas e 16 bicos: reparte de forma uniforme", () => {
    const a = estruturaDoEscopo(escopo({ qtd_postos: 2, qtd_pistas: 4, qtd_bombas: 8, qtd_bicos: 16 }));
    expect(a.postos).toHaveLength(2);
    expect(a.postos[0].ilhas).toHaveLength(2);
    expect(a.postos[0].ilhas[0].bombas).toHaveLength(2);
    expect(a.postos[0].ilhas[0].bombas[0].bicos).toBe(2);
    expect(a.comboios).toHaveLength(0);
  });
  it("só comboio: não cria posto", () => {
    const a = estruturaDoEscopo(escopo({ tem_comboio: true, qtd_comboios: 3 }));
    expect(a.postos).toHaveLength(0);
    expect(a.comboios).toHaveLength(3);
  });
  it("pista e comboio juntos", () => {
    const a = estruturaDoEscopo(escopo({ tem_pista: true, qtd_bombas: 3, tem_comboio: true }));
    expect(a.postos).toHaveLength(1);
    expect(a.postos[0].ilhas[0].bombas).toHaveLength(3);
    expect(a.comboios).toHaveLength(1);
  });
  it("sem dados, mantém a configuração e fica vazio", () => {
    const a = estruturaDoEscopo(null, { solucao: "SAAF" });
    expect(a.config.solucao).toBe("SAAF");
    expect(a.postos).toHaveLength(0);
    expect(estruturaEhVazia(a)).toBe(true);
  });
  it("respeita os limites", () => {
    const a = estruturaDoEscopo(escopo({ qtd_postos: 99, qtd_comboios: 99 }));
    expect(a.postos).toHaveLength(20);
    expect(a.comboios).toHaveLength(50);
  });
});
