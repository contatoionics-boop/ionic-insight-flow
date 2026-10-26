import { describe, expect, it } from "vitest";
import { normalizarEscopo } from "@/lib/proposta/tipos";
import { estruturaDoEscopo, estruturaEhVazia } from "./sugerir";

const escopo = (campos: Record<string, unknown>) =>
  normalizarEscopo(Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, { valor: v, confianca: 1, origem: "escopo" }])));

describe("estruturaDoEscopo", () => {
  it("preenche só postos, comboios, tanques com lubrificante e sondas", () => {
    const a = estruturaDoEscopo(
      escopo({ qtd_postos: 2, qtd_comboios: 3, qtd_tanques_lubrificante: 1, qtd_sondas: 4, qtd_bombas: 8, qtd_bicos: 16, qtd_pistas: 4 }),
    );
    expect(a.postos).toHaveLength(2);
    expect(a.postos[0].ilhas).toHaveLength(0); // ilhas, bombas e bicos ficam para o usuário
    expect(a.comboios).toHaveLength(3);
    expect(a.tanquesLubrificante).toHaveLength(1);
    expect(a.sondas).toHaveLength(4);
  });
  it("só comboio: não cria posto", () => {
    const a = estruturaDoEscopo(escopo({ tem_comboio: true }));
    expect(a.postos).toHaveLength(0);
    expect(a.comboios).toHaveLength(1);
  });
  it("pista sem quantidade de postos: 1 posto", () => {
    expect(estruturaDoEscopo(escopo({ tem_pista: true })).postos).toHaveLength(1);
  });
  it("sem dados, mantém a configuração e fica vazio", () => {
    const a = estruturaDoEscopo(null, { solucao: "SAAF" });
    expect(a.config.solucao).toBe("SAAF");
    expect(estruturaEhVazia(a)).toBe(true);
  });
  it("respeita os limites", () => {
    const a = estruturaDoEscopo(escopo({ qtd_postos: 99, qtd_comboios: 99, qtd_sondas: 999 }));
    expect(a.postos).toHaveLength(20);
    expect(a.comboios).toHaveLength(50);
    expect(a.sondas).toHaveLength(50);
  });
});
