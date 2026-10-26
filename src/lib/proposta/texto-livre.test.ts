import { describe, expect, it } from "vitest";
import { extrairEscopoDeterministico } from "./extrair.server";
import { estruturaDoEscopo } from "@/lib/escopo/sugerir";

describe("escopo digitado à mão (texto livre)", () => {
  const texto = "Instalação em 2 postos, com 4 pistas, 8 bombas e 16 bicos no total, mais 2 caminhões comboio.";

  it("lê postos, pistas, bombas, bicos e comboios do próprio texto", () => {
    const e = extrairEscopoDeterministico(texto, { textoLivre: true });
    expect(e.qtd_postos.valor).toBe(2);
    expect(e.qtd_pistas.valor).toBe(4);
    expect(e.qtd_bombas.valor).toBe(8);
    expect(e.qtd_bicos.valor).toBe(16);
    expect(e.tem_comboio.valor).toBe(true);
    expect(e.qtd_comboios.valor).toBe(2);
  });

  it("sem a opção, o texto sem seções de proposta não confirma nada (comportamento do PDF)", () => {
    const e = extrairEscopoDeterministico(texto);
    expect(e.qtd_postos.valor).toBeNull();
  });

  it("e a estrutura sugerida acompanha essas quantidades", () => {
    const a = estruturaDoEscopo(extrairEscopoDeterministico(texto, { textoLivre: true }));
    expect(a.postos).toHaveLength(2);
    expect(a.postos[0].ilhas).toHaveLength(2);
    expect(a.comboios).toHaveLength(2);
  });
});
