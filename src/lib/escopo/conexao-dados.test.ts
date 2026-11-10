import { describe, expect, it } from "vitest";
import { ehConexaoDados, normalizarConfig } from "./tipos";

describe("conexão de dados no Escopo", () => {
  it("guarda a do posto e a do comboio separadas e ignora valores inválidos", () => {
    expect(normalizarConfig({ comunicacao_posto: "wifi", comunicacao_comboio: "4g" })).toEqual({ comunicacao_posto: "wifi", comunicacao_comboio: "4g" });
    expect(normalizarConfig({ comunicacao_posto: "lixo" as any, comunicacao_comboio: null })).toEqual({});
    expect(ehConexaoDados("ambos")).toBe(true);
    expect(ehConexaoDados("x")).toBe(false);
  });
});
