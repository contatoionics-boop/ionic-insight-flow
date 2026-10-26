import { describe, expect, it } from "vitest";
import { extrairEscopoDeterministico } from "./extrair.server";
import { estruturaDoEscopo } from "@/lib/escopo/sugerir";

describe("escopo digitado à mão (texto livre)", () => {
  const texto = "Instalação em 2 postos, com 2 caminhões comboio, 1 tanque de lubrificante e 3 sondas de nível.";

  it("lê postos, comboios, tanques com lubrificante e sondas do próprio texto", () => {
    const e = extrairEscopoDeterministico(texto, { textoLivre: true });
    expect(e.qtd_postos.valor).toBe(2);
    expect(e.tem_comboio.valor).toBe(true);
    expect(e.qtd_comboios.valor).toBe(2);
    expect(e.qtd_tanques_lubrificante.valor).toBe(1);
    expect(e.qtd_sondas.valor).toBe(3);
  });

  it("sem a opção, o texto sem seções de proposta não confirma nada (comportamento do PDF)", () => {
    expect(extrairEscopoDeterministico(texto).qtd_postos.valor).toBeNull();
  });

  it("e a estrutura sugerida acompanha essas quantidades", () => {
    const a = estruturaDoEscopo(extrairEscopoDeterministico(texto, { textoLivre: true }));
    expect([a.postos.length, a.comboios.length, a.tanquesLubrificante.length, a.sondas.length]).toEqual([2, 2, 1, 3]);
  });
});
