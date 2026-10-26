import { describe, expect, it } from "vitest";
import { aceitaProduto, aplicarProdutoNaLinha, colunaDeBusca, inserirProduto, linhaDoProduto, removerColuna } from "./produto-linha";

const p = { codigo: "2.2.08.06.000", nome: "NIPLE DUPLO 1\" - ROSCA NPT" };
const materiais = ["Código", "Descrição", "Aplicação", "Un.", "Qtd."];

describe("produto do catálogo numa tabela do documento", () => {
  it("só tabelas com código e descrição aceitam produto", () => {
    expect(aceitaProduto(materiais)).toBe(true);
    expect(aceitaProduto(["Código", "Descrição", "Qtd."])).toBe(true);
    expect(aceitaProduto(["Bitola", "Faixa de vazão", "Conexão"])).toBe(false);
  });
  it("preenche código, descrição e quantidade 1; o resto fica em branco", () => {
    expect(linhaDoProduto(materiais, p).celulas).toEqual([p.codigo, p.nome, "", "", "1"]);
    expect(linhaDoProduto(["Código", "Descrição", "Qtd."], p).celulas).toEqual([p.codigo, p.nome, "1"]);
  });
  it("usa a linha em branco de preenchimento em vez de deixar uma linha vazia sobrando", () => {
    const r = inserirProduto([{ celulas: ["", "", "", "", ""] }], materiais, p);
    expect(r).toHaveLength(1);
    expect(r[0].celulas[0]).toBe(p.codigo);
  });
  it("acrescenta ao final quando já há itens", () => {
    const existente = { celulas: ["1", "X", "", "", "2"] };
    const r = inserirProduto([existente, { celulas: ["", "", "", "", ""] }], materiais, p);
    expect(r).toHaveLength(3);
    expect(r[2].celulas[0]).toBe(p.codigo);
  });
});

describe("busca ao digitar e exclusão de coluna", () => {
  it("só Código e Descrição disparam a busca", () => {
    expect(colunaDeBusca("Código")).toBe("codigo");
    expect(colunaDeBusca("Descrição")).toBe("descricao");
    expect(colunaDeBusca("Aplicação")).toBeNull();
    expect(colunaDeBusca("Qtd.")).toBeNull();
  });
  it("aplicar o produto na linha mantém o que já foi digitado nas outras colunas", () => {
    const l = aplicarProdutoNaLinha({ celulas: ["niple", "", "Bico", "un", ""] }, materiais, p);
    expect(l.celulas).toEqual([p.codigo, p.nome, "Bico", "un", "1"]);
    expect(aplicarProdutoNaLinha({ celulas: ["", "", "", "", "5"] }, materiais, p).celulas[4]).toBe("5");
  });
  it("remove só a coluna escolhida, não a linha", () => {
    const linhas = [{ celulas: ["a", "b", "c"] }, { celulas: ["d", "e", "f"] }];
    const r = removerColuna(["X", "Y", "Z"], linhas, 1);
    expect(r.colunas).toEqual(["X", "Z"]);
    expect(r.linhas).toEqual([{ celulas: ["a", "c"] }, { celulas: ["d", "f"] }]);
  });
  it("nunca deixa a tabela sem colunas", () => {
    const linhas = [{ celulas: ["a"] }];
    expect(removerColuna(["X"], linhas, 0)).toEqual({ colunas: ["X"], linhas });
  });
});
