import { describe, expect, it } from "vitest";
import { montarContextoLaudo } from "@/lib/laudo/contexto";
import { arvoreVazia } from "@/lib/escopo/tipos";
import { montarBlocos } from "@/lib/laudo/template";
import { renumerar } from "@/lib/laudo/numeracao";
import { blocosDiv, blocosRfid, blocosTx } from "./extras";

const ids = (p: string) => `${p}-x`;
const ctx = (config: any, frota?: any) =>
  montarContextoLaudo({ entidades: [], arvore: { ...arvoreVazia(), config, ...(frota ? { frota } : {}) } as any, respostas: [] });
const textos = (b: any[] | null) => JSON.stringify(b ?? []);

describe("Cartão RFID", () => {
  it("só entra com RFID no Escopo; quantidade e tecnologia vêm dele", () => {
    expect(blocosRfid({ contexto: ctx({}), id: ids })).toBeNull();
    expect(blocosRfid({ contexto: null, id: ids })).toBeNull();
    const b = blocosRfid({ contexto: ctx({ rfid: { ativo: true, itens: [{ tecnologia: "Mifare", quantidade: 70 }] } }), id: ids }) as any[];
    expect(b.map((x) => x.chave)).toEqual(["rfid:titulo", "rfid:resumo", "rfid:compatibilidade"]);
    expect(b[1].texto).toContain("70 cartões RFID, tecnologia Mifare");
    expect(b[2].texto).toContain("T1000");
  });
  it("sem tecnologia ou quantidade vira [CONFIRMAR], nunca texto inventado", () => {
    const b = blocosRfid({ contexto: ctx({ rfid: { ativo: true, itens: [] } }), id: ids }) as any[];
    expect(b[1].texto).toContain("[CONFIRMAR: tecnologia do cartão RFID");
    expect(b[1].texto).toContain("[CONFIRMAR: quantidade de cartões RFID");
  });
});

describe("DIV", () => {
  const frota = { ativo: true, itens: [{ modelo: "DIV Básico", quantidade: 26 }, { modelo: "DIV Wireless", quantidade: 14 }] };
  it("só no Nível 2 e com frota; tabela automática com uma linha por tipo (sem linhas em branco)", () => {
    expect(blocosDiv({ contexto: ctx({}, frota), id: ids, nivel2: false })).toBeNull();
    expect(blocosDiv({ contexto: ctx({}), id: ids, nivel2: true })).toBeNull();
    const b = blocosDiv({ contexto: ctx({}, frota), id: ids, nivel2: true }) as any[];
    const t = b.find((x) => x.chave === "div:tipos");
    expect(t.linhas.map((l: any) => l.celulas)).toEqual([["DIV Básico", "26"], ["DIV Wireless", "14"]]);
    expect(b.find((x) => x.chave === "div:resumo").texto).toContain("40 DIV");
  });
  it("frota ativa sem tipos: pendência em vez de tabela", () => {
    const b = blocosDiv({ contexto: ctx({}, { ativo: true, itens: [] }), id: ids, nivel2: true }) as any[];
    expect(b.some((x) => x.tipo === "table")).toBe(false);
    expect(textos(b)).toContain("[CONFIRMAR: tipos e quantidades de DIV");
  });
});

describe("Telemetria TX", () => {
  it("só a estrutura: título e bloco editável pendente, sem texto técnico inventado", () => {
    expect(blocosTx({ contexto: ctx({}), id: ids })).toBeNull();
    const b = blocosTx({ contexto: ctx({ tx: { ativo: true, itens: [{ modelo: "TX", quantidade: 2 }] } }), id: ids }) as any[];
    expect(b.map((x) => x.chave)).toEqual(["tx:titulo", "tx:texto"]);
    expect(b[1].texto).toBe("[CONFIRMAR: texto da Telemetria TX]");
    expect(b[1].destaque).toBe("editavel");
  });
});

describe("RFID, DIV e TX no documento", () => {
  const cab = { cliente: "C", unidade: "U", data: "01/01/2026", agente: "A", especialista: "P", modalidade: "remoto" };
  const nova = (chave: string, valor: string) => ({ chave, valor, origem: "formulario" as const, confianca: 1 });
  const config = { rfid: { ativo: true, itens: [{ tecnologia: "Mifare", quantidade: 70 }] }, tx: { ativo: true, itens: [{ modelo: "TX", quantidade: 1 }] } };
  const frota = { ativo: true, itens: [{ modelo: "DIV Básico", quantidade: 5 }] };
  const montar = (nivel: string) =>
    renumerar(montarBlocos({ variaveis: { nivel_servico: nova("nivel_servico", nivel) }, materiais: [], cabecalho: cab, contexto: ctx(config, frota) }) as any[]) as any[];

  it("ficam depois dos bicos e antes das Instruções gerais, numerados em sequência", () => {
    const b = montar("nivel_2");
    const pos = (chave: string) => b.findIndex((x) => x.chave === chave);
    const instrucoes = b.findIndex((x) => x.tipo === "heading" && x.texto === "Instruções gerais");
    expect(pos("rfid:titulo")).toBeGreaterThan(pos("nivel2:2.4"));
    expect(pos("div:titulo")).toBeGreaterThan(pos("rfid:titulo"));
    expect(pos("tx:titulo")).toBeGreaterThan(pos("div:titulo"));
    expect(instrucoes).toBeGreaterThan(pos("tx:texto"));
    const nums = ["rfid:titulo", "div:titulo", "tx:titulo"].map((c) => Number(b[pos(c)].numero.split(".")[1]));
    expect(nums[1]).toBe(nums[0] + 1);
    expect(nums[2]).toBe(nums[1] + 1);
  });
  it("Nível 1: o DIV não entra, RFID e TX continuam", () => {
    const chaves = montar("nivel_1").map((x) => x.chave);
    expect(chaves).toContain("rfid:titulo");
    expect(chaves).toContain("tx:titulo");
    expect(chaves).not.toContain("div:titulo");
  });
});
