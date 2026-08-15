import { describe, expect, it } from "vitest";
import { montarBlocos } from "@/lib/laudo/template";
import type { VariaveisLaudo } from "@/lib/laudo/tipos";

function vars(entradas: Record<string, string>): VariaveisLaudo {
  return Object.fromEntries(
    Object.entries(entradas).map(([chave, valor]) => [
      chave,
      { chave, valor, origem: "proposta" as const, confianca: 1 },
    ]),
  );
}

function montar(entradas: Record<string, string>) {
  return montarBlocos({
    variaveis: vars(entradas),
    materiais: [],
    cabecalho: {
      cliente: "Cliente",
      unidade: "Unidade",
      data: "01/01/2026",
      agente: "Agente",
      especialista: "PABLO",
      modalidade: "presencial",
    },
  });
}

function texto(blocos: any[]): string {
  return JSON.stringify(blocos).toLowerCase();
}

function temHeading(blocos: any[], titulo: string) {
  return blocos.some(
    (b) => b.tipo === "heading" && String(b.texto).toLowerCase().includes(titulo.toLowerCase()),
  );
}

describe("seção 2.1 — Equipamentos de TI e banco de dados", () => {
  it("SAAF: inclui a seção 2.1 com banco de dados e integração ERP", () => {
    const blocos = montar({ nome_solucao: "SAAF", nivel_servico: "nivel_1" });
    expect(temHeading(blocos, "Equipamentos de TI e banco de dados")).toBe(true);
    const t = texto(blocos);
    expect(t).toContain("banco de dados saaf");
    expect(t).toContain("integração com erps");
  });

  it("SSG Frota: omite a seção 2.1 e todo conteúdo de servidor/banco/ERP", () => {
    const blocos = montar({ nome_solucao: "SSG Frota", nivel_servico: "nivel_1" });
    expect(temHeading(blocos, "Equipamentos de TI e banco de dados")).toBe(false);
    const t = texto(blocos);
    expect(t).not.toContain("banco de dados");
    expect(t).not.toContain("erps");
    expect(t).not.toContain("especificação do servidor");
    expect(t).not.toContain("computador de consulta");
    // segue direto para a próxima seção aplicável
    expect(temHeading(blocos, "Transferência de dados")).toBe(true);
  });

  it("solução não identificada: não assume SAAF e registra pendência", () => {
    const blocos = montar({ nivel_servico: "nivel_1" });
    expect(temHeading(blocos, "Equipamentos de TI e banco de dados")).toBe(false);
    expect(texto(blocos)).toContain("[confirmar");
  });

  it("SETEL (SSG Frota, Nível 2, pista sem comboio): sem 2.1 SAAF, com 2.4 e sem 2.4.1", () => {
    const blocos = montar({
      nome_solucao: "SSG Frota",
      nivel_servico: "nivel_2",
      objeto_escopo: "01 posto fixo, 01 bomba mecânica com 01 bico",
      tipo_objeto: "pista",
    });
    expect(temHeading(blocos, "Equipamentos de TI e banco de dados")).toBe(false);
    const t = texto(blocos);
    expect(t).toContain("2.4. bicos de abastecimento");
    expect(t).not.toContain("2.4.1");
  });
});
