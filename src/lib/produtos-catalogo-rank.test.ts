import { describe, expect, it } from "vitest";
import { ordenarPorRelevancia } from "./produtos-catalogo-rank";

const itens = [
  { codigo: "2.0.01.01.008", nome: "MONITOR DE ACIONAMENTO DE VALVULAS SOLENOIDES" },
  { codigo: "2.2.08.04.00F", nome: "VALVULA SOLENOIDE 1\" 12V TPL" },
  { codigo: "2.2.08.04.00A", nome: "BOBINA PARA VALVULA SOLENOIDE" },
  { codigo: "3.3.00.00.001", nome: "CABO PP 2X1,5MM" },
];

describe("ordenarPorRelevancia", () => {
  it("o que começa com o texto digitado vem antes do que só contém", () => {
    const r = ordenarPorRelevancia(itens, "valvula sol");
    expect(r[0].codigo).toBe("2.2.08.04.00F");
  });
  it("texto seguido (contém) vem antes de palavras soltas", () => {
    const r = ordenarPorRelevancia(itens, "valvula sol").map((i) => i.codigo);
    expect(r.indexOf("2.2.08.04.00A")).toBeLessThan(r.indexOf("2.0.01.01.008"));
  });
  it("ignora acento e maiúsculas; sem consulta, ordem alfabética", () => {
    expect(ordenarPorRelevancia(itens, "VÁLVULA sol")[0].codigo).toBe("2.2.08.04.00F");
    expect(ordenarPorRelevancia(itens, "")[0].nome).toBe("BOBINA PARA VALVULA SOLENOIDE");
  });
  it("pelo código", () => {
    expect(ordenarPorRelevancia(itens, "3.3.00")[0].nome).toBe("CABO PP 2X1,5MM");
  });
});
