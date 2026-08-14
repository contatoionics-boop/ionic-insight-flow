import { describe, it, expect } from "vitest";
import { montarBlocosEAnalise } from "@/lib/laudo/template";
import { produtosDaProposta } from "@/lib/laudo/produtos-proposta";
import { valorDaResposta } from "@/lib/laudo/respostas";
import { chavesDaPergunta } from "@/lib/laudo/aliases";

const base = {
  variaveis: { nivel_servico: { chave: "nivel_servico", valor: "nivel_2", origem: "formulario" as const, confianca: 1 } },
  materiais: [],
  cabecalho: { cliente: "X", unidade: "U", data: "01/01/2026", agente: "A", especialista: "", modalidade: null },
};
const tabela = (blocos: any[]) => blocos.find((b) => b.tipo === "table" && b.titulo === "Produtos IONICS");

describe("Produtos IONICS", () => {
  it("A) usa somente itens da proposta", () => {
    const produtos = produtosDaProposta({
      itens_inclusos: { valor: ["2x Terminal SSG Frota", "2.0.03.01.026 - NLDIV Wireless 3/4\"", "Serviço de instalação"], confianca: 0.9 },
    } as any);
    expect(produtos).toEqual([
      { codigo: null, descricao: "Terminal SSG Frota", quantidade: "2" },
      { codigo: "2.0.03.01.026", descricao: 'NLDIV Wireless 3/4"', quantidade: null },
      { codigo: null, descricao: "Serviço de instalação", quantidade: null },
    ]);
    const t = tabela(montarBlocosEAnalise({ ...base, produtosProposta: produtos } as any).blocos);
    expect(t.linhas.map((l: any) => l.celulas[1])).toEqual(produtos.map((p) => p.descricao));
    expect(t.editavel).toBe(true);
  });

  it("B) sem proposta: tabela vazia, sem produtos automáticos", () => {
    const { blocos } = montarBlocosEAnalise(base as any);
    const t = tabela(blocos);
    expect(t.linhas).toHaveLength(0);
    expect(t.editavel).toBe(true);
    const json = JSON.stringify(blocos.filter((b: any) => b.tipo === "table"));
    for (const termo of ["T1000", "WiFi Multi", "Válvula", "Sensor de", "Fonte "]) {
      expect(json).not.toContain(termo);
    }
    expect(produtosDaProposta({ itens_inclusos: { valor: null, confianca: 0 } } as any)).toEqual([]);
  });
});

describe("C) cabeçalho a partir do formulário", () => {
  it("normaliza tipos de resposta", () => {
    expect(valorDaResposta({ tipo: "data", valor_texto: "2026-08-14" })).toBe("14/08/2026");
    expect(valorDaResposta({ tipo: "toggle", valor_texto: "true" })).toBe("sim");
    expect(valorDaResposta({ tipo: "multipla_escolha", valor_texto: '["Leve","Pesados"]' })).toBe("Leve, Pesados");
    expect(valorDaResposta({ tipo: "texto", valor_texto: '{"nome":"Ana"}' })).toBe("nome: Ana");
    expect(valorDaResposta({ tipo: "foto", valor_texto: "casos/1/x.png" })).toBeNull();
    expect(valorDaResposta({ tipo: "audio", valor_texto: null, transcricao: "  Fulano  " })).toBe("Fulano");
  });
  it("resolve aliases do cabeçalho", () => {
    expect(chavesDaPergunta("Analista de Projetos responsável")).toContain("analista_projetos");
    expect(chavesDaPergunta("Especialista em Automação")).toContain("especialista_automacao");
    expect(chavesDaPergunta("Agente Técnico Credenciado IONICS")).toContain("agente_tecnico");
    expect(chavesDaPergunta("Data do mapeamento")).toContain("data_mapeamento");
    expect(chavesDaPergunta("Cliente / Unidade")).toContain("nome_cliente");
  });
});
