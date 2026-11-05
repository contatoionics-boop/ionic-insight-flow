import { describe, expect, it } from "vitest";
import { montarContextoLaudo } from "@/lib/laudo/contexto";
import { arvoreVazia, type EntidadeEscopo } from "@/lib/escopo/tipos";
import { montarBlocos } from "@/lib/laudo/template";
import { renumerar } from "@/lib/laudo/numeracao";

const ent = (id: string, tipo: EntidadeEscopo["tipo"], rotulo: string, parent_id: string | null, ordem = 0): EntidadeEscopo => ({ id, tipo, rotulo, parent_id, ordem });
const cab = { cliente: "C", unidade: "U", data: "01/01/2026", agente: "A", especialista: "P", modalidade: "remoto" };
const nova = (chave: string, valor: string) => ({ chave, valor, origem: "formulario" as const, confianca: 1 });
const variaveis = (nivel: string) => ({ nivel_servico: nova("nivel_servico", nivel) });

const comComboio = montarContextoLaudo({
  entidades: [ent("c1", "comboio", "Comboio 01", null), ent("k1", "bico", "Bico 01", "c1")],
  arvore: { ...arvoreVazia(), config: { solucao: "ssg_frota" } as any },
  respostas: [],
});
const soPista = montarContextoLaudo({
  entidades: [ent("p", "posto", "Posto 01", null), ent("i", "ilha", "Ilha 01", "p"), ent("b1", "bomba", "Bomba 01", "i")],
  arvore: { ...arvoreVazia(), postos: [{ ilhas: [] }], config: { solucao: "on_premise" } as any },
  respostas: [],
});

const montar = (nivel: string, contexto: any) => renumerar(montarBlocos({ variaveis: variaveis(nivel), materiais: [], cabecalho: cab, contexto }) as any[]) as any[];
const titulos = (b: any[]) => b.filter((x) => x.tipo === "heading").map((x) => `${x.numero ?? "-"} ${x.texto}`);

describe("Nível 2 / NLDIV com o Escopo", () => {
  it("os títulos são numerados automaticamente, depois do Caminhão comboio, sem o título interno 'VII'", () => {
    const t = titulos(montar("nivel_2", comComboio));
    expect(t.some((x) => /VII\./.test(x))).toBe(false);
    const iComboio = t.findIndex((x) => /Caminhão comboio/.test(x));
    const iBicos = t.findIndex((x) => /Bicos de abastecimento/.test(x));
    const iSuporte = t.findIndex((x) => /Adequação do suporte/.test(x));
    expect(iComboio).toBeGreaterThan(-1);
    expect(iBicos).toBeGreaterThan(iComboio);
    expect(iSuporte).toBe(iBicos + 1);
    // números reais (calculados), nunca o "2.4." fixo do texto
    expect(t[iBicos]).toMatch(/^3\.\d Bicos/);
    expect(t[iSuporte]).toMatch(/^3\.\d\.1 Adequação/);
  });
  it("o 2.4.1 vem do comboio do Escopo, mesmo sem evidência nas variáveis", () => {
    const chaves = (b: any[]) => b.map((x) => x.chave);
    expect(chaves(montar("nivel_2", comComboio))).toContain("nivel2:2.4.1");
    expect(chaves(montar("nivel_2", soPista))).not.toContain("nivel2:2.4.1");
    expect(chaves(montar("nivel_2", soPista))).toContain("nivel2:2.4");
  });
  it("o nome da solução vem do Escopo, não do texto livre", () => {
    const texto = (b: any[]) => b.find((x) => x.chave === "nivel2:2.4:texto-1").texto;
    expect(texto(montar("nivel_2", comComboio))).toContain("Solução SSGFROTA");
    expect(texto(montar("nivel_2", soPista))).toContain("Solução On-premise");
  });
  it("Nível 1: nada de Nível 2", () => {
    expect(montar("nivel_1", comComboio).some((x) => String(x.chave ?? "").startsWith("nivel2:"))).toBe(false);
  });
});
