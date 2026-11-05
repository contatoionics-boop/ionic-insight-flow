import { describe, expect, it } from "vitest";
import { arvoreVazia } from "@/lib/escopo/tipos";
import { montarContextoLaudo } from "./contexto";
import { renumerar } from "./numeracao";
import { montarBlocos } from "./template";
import { blocosPadraoAutomaticos, lerRegra, padraoCobre, regraAtende, regraParaEscopo, resumoDaRegra, type BlocoPadraoAuto } from "./blocos-padrao-regras";

const ctx = (config: any) => montarContextoLaudo({ entidades: [], arvore: { ...arvoreVazia(), config } as any, respostas: [] });
const id = (p: string) => `${p}-x`;
const padrao = (escopo: any, extra: Partial<BlocoPadraoAuto> = {}): BlocoPadraoAuto => ({
  id: "p1", nome: "Telemetria TX", escopo,
  blocos: [
    { id: "a", tipo: "heading", numero: null, texto: "Telemetria (TX)", nivel: 3 },
    { id: "b", tipo: "paragraph", texto: "Texto técnico da telemetria." },
  ] as any,
  ...extra,
});

describe("regra do bloco padrão", () => {
  it("lê e grava só o que foi preenchido; sem 'automatico' é inserção manual", () => {
    expect(lerRegra({}).automatico).toBe(false);
    expect(lerRegra(null).exige).toEqual([]);
    expect(lerRegra({ automatico: true, exige: ["tx", "lixo"], nivel: "x" })).toEqual({ automatico: true, solucao: [], nivel: [], exige: ["tx"] });
    expect(regraParaEscopo({ automatico: false, solucao: ["ssg_frota"], nivel: [], exige: [] })).toEqual({});
    expect(regraParaEscopo({ automatico: true, solucao: [], nivel: ["nivel_2"], exige: [] })).toEqual({ automatico: true, nivel: ["nivel_2"] });
  });
  it("resume a regra em português", () => {
    expect(resumoDaRegra(lerRegra({}))).toBe("Inserção manual");
    expect(resumoDaRegra(lerRegra({ automatico: true }))).toBe("Automático: em todos os documentos");
    expect(resumoDaRegra(lerRegra({ automatico: true, nivel: ["nivel_2"], exige: ["tx", "comboio"] }))).toBe("Automático: Nível 2 · com Telemetria TX e Comboio");
  });
  it("só entra quando o caso atende todas as condições", () => {
    const r = lerRegra({ automatico: true, solucao: ["ssg_frota"], nivel: ["nivel_2"], exige: ["tx"] });
    const comTx = ctx({ solucao: "ssg_frota", tx: { ativo: true, itens: [{ modelo: "TX", quantidade: 1 }] } });
    expect(regraAtende(r, { nivel: "nivel_2", contexto: comTx })).toBe(true);
    expect(regraAtende(r, { nivel: "nivel_1", contexto: comTx })).toBe(false);
    expect(regraAtende(r, { nivel: "nivel_2", contexto: ctx({ solucao: "on_premise", tx: { ativo: true, itens: [{ modelo: "TX", quantidade: 1 }] } }) })).toBe(false);
    expect(regraAtende(r, { nivel: "nivel_2", contexto: ctx({ solucao: "ssg_frota" }) })).toBe(false);
    expect(regraAtende(r, { nivel: null, contexto: null })).toBe(false);
  });
  it("manual nunca entra sozinho; automático sem condição entra sempre", () => {
    expect(regraAtende(lerRegra({}), { nivel: "nivel_1", contexto: ctx({}) })).toBe(false);
    expect(regraAtende(lerRegra({ automatico: true }), { nivel: null, contexto: null })).toBe(true);
  });
});

describe("blocos dos padrões automáticos", () => {
  const a = { nivel: "nivel_1", contexto: ctx({ tx: { ativo: true, itens: [{ modelo: "TX", quantidade: 1 }] } }) };
  it("ganham chave estável, são editáveis e o título vira seção numerada", () => {
    const b = blocosPadraoAutomaticos([padrao({ automatico: true, exige: ["tx"] })], a, id) as any[];
    expect(b.map((x) => x.chave)).toEqual(["padrao:p1:0", "padrao:p1:1"]);
    expect(b[0]).toMatchObject({ tipo: "heading", nivel: 2, numero: "0", editavel: true });
    expect(blocosPadraoAutomaticos([padrao({ automatico: true, exige: ["comboio"] })], a, id)).toEqual([]);
  });
  it("padrão que exige TX cobre o espaço vazio da TX", () => {
    expect(padraoCobre([padrao({ automatico: true, exige: ["tx"] })], a, "tx")).toBe(true);
    expect(padraoCobre([padrao({ automatico: true, exige: ["tx"] }, { blocos: [] })], a, "tx")).toBe(false);
    expect(padraoCobre([padrao({ automatico: true })], a, "tx")).toBe(false);
  });
});

describe("no documento", () => {
  const cab = { cliente: "C", unidade: "U", data: "01/01/2026", agente: "A", especialista: "P", modalidade: "remoto" };
  const nova = (chave: string, valor: string) => ({ chave, valor, origem: "formulario" as const, confianca: 1 });
  const config = { tx: { ativo: true, itens: [{ modelo: "TX", quantidade: 1 }] } };
  const montar = (padroes: BlocoPadraoAuto[]) =>
    renumerar(montarBlocos({ variaveis: { nivel_servico: nova("nivel_servico", "nivel_1") }, materiais: [], cabecalho: cab, contexto: ctx(config), blocosPadrao: padroes }) as any[]) as any[];

  it("entra antes das Instruções gerais, numerado, e substitui o espaço vazio da TX", () => {
    const b = montar([padrao({ automatico: true, exige: ["tx"] })]);
    const chaves = b.map((x) => x.chave);
    expect(chaves).toContain("padrao:p1:0");
    expect(chaves).not.toContain("tx:titulo");
    const i = b.findIndex((x) => x.chave === "padrao:p1:0");
    const instr = b.findIndex((x) => x.tipo === "heading" && x.texto === "Instruções gerais");
    expect(instr).toBeGreaterThan(i);
    expect(b[i].numero).toMatch(/^3\.\d+$/);
    expect(b[instr].numero).toBe(String(Number(b[i].numero.split(".")[0]) + 1));
  });
  it("sem padrão, o documento segue como antes (espaço da TX com pendência)", () => {
    const chaves = montar([]).map((x) => x.chave);
    expect(chaves).toContain("tx:titulo");
    expect(chaves.some((c) => String(c ?? "").startsWith("padrao:"))).toBe(false);
  });
});
