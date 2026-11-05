import { describe, expect, it } from "vitest";
import { contextoRegrasDeVariaveis, equipamentoComoMaterial, inserirMateriais, linhaDoMaterial, motivoDaSugestao, sugerirMateriais } from "./sugestoes";
import type { MaterialCatalogo } from "./regras";

const mat = (codigo: string, regra: MaterialCatalogo["regra"] = {}, extra: Partial<MaterialCatalogo> = {}): MaterialCatalogo => ({
  id: codigo, codigo, descricao: `Item ${codigo}`, aplicacao: "Pista", unidade: "un", quantidade_padrao: 2, regra, ativo: true, ordem: 10, ...extra,
});
const v = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).map(([k, valor]) => [k, { chave: k, valor, origem: "formulario" as const, confianca: 1 }]));
const colunas = ["Código", "Descrição", "Aplicação", "Un.", "Qtd."];

describe("sugestão de materiais", () => {
  it("o contexto das regras sai das variáveis do laudo", () => {
    const c = contextoRegrasDeVariaveis(v({ nivel_servico: "nivel_2", bitola_bico: "3/4 polegada", tipo_objeto: "Pista", area_classificada: "sim" }) as any);
    expect(c).toMatchObject({ nivel: "nivel_2", bitola: '3/4"', tipoObjeto: "pista", areaClassificada: true });
  });
  it("só sugere o que as regras indicam", () => {
    const cat = [mat("A"), mat("B", { nivel: ["nivel_2"] }), mat("C", { bitola: ['1"'] }), mat("D", {}, { ativo: false })];
    const ctx = contextoRegrasDeVariaveis(v({ nivel_servico: "nivel_1", bitola_bico: '3/4"' }) as any);
    expect(sugerirMateriais(cat, ctx, [], colunas).map((m) => m.codigo)).toEqual(["A"]);
  });
  it("não repete o que já está na tabela (por código)", () => {
    const ctx = contextoRegrasDeVariaveis(v({}) as any);
    const linhas = [{ celulas: ["a", "x", "", "", ""] }];
    expect(sugerirMateriais([mat("A"), mat("B")], ctx, linhas, colunas).map((m) => m.codigo)).toEqual(["B"]);
  });
  it("monta a linha pelas colunas e usa a quantidade padrão", () => {
    expect(linhaDoMaterial(colunas, mat("A")).celulas).toEqual(["A", "Item A", "Pista", "un", "2"]);
  });
  it("a linha em branco da tabela é substituída; com itens, acrescenta", () => {
    const vazia = [{ celulas: ["", "", "", "", ""] }];
    expect(inserirMateriais(vazia, colunas, [mat("A")])).toHaveLength(1);
    expect(inserirMateriais(vazia, colunas, [mat("A")])[0]!.celulas[0]).toBe("A");
    const cheia = [{ celulas: ["Z", "z", "", "", "1"] }];
    expect(inserirMateriais(cheia, colunas, [mat("A")]).map((l) => l.celulas[0])).toEqual(["Z", "A"]);
    expect(inserirMateriais(cheia, colunas, [])).toBe(cheia);
  });
  it("explica o motivo da sugestão", () => {
    expect(motivoDaSugestao(mat("A"))).toBe("Aplica-se a todos os mapeamentos");
    expect(motivoDaSugestao(mat("B", { nivel: ["nivel_2"], bitola: ['1"'] }))).toBe('Regra: nível 2, bitola 1"');
  });
  it("equipamento do catálogo entra como item sugerível, com as mesmas regras", () => {
    const e = equipamentoComoMaterial({ codigo: "NOVO-1", nome: "Sensor X", categoria: "Sensores", unidade: null, quantidade_padrao: "2", regra: { nivel: ["nivel_2"] } });
    expect(e).toMatchObject({ id: "NOVO-1", codigo: "NOVO-1", descricao: "Sensor X", aplicacao: "Sensores", unidade: "un", quantidade_padrao: 2, ativo: true });
    const ctx2 = contextoRegrasDeVariaveis(v({ nivel_servico: "nivel_2" }) as any);
    const ctx1 = contextoRegrasDeVariaveis(v({ nivel_servico: "nivel_1" }) as any);
    expect(sugerirMateriais([e], ctx2, [], ["Código", "Descrição", "Qtd."])).toHaveLength(1);
    expect(sugerirMateriais([e], ctx1, [], ["Código", "Descrição", "Qtd."])).toHaveLength(0);
    expect(equipamentoComoMaterial({ codigo: "A", nome: "a", quantidade_padrao: "x" }).quantidade_padrao).toBe(1);
  });
});
