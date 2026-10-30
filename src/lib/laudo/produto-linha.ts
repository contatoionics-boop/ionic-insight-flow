// Inserção de um produto do catálogo numa tabela do documento (client-safe, função pura).

type Linha = { celulas: string[] };

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

/** A tabela tem coluna de código e de descrição (Produtos IONICS, Materiais de infraestrutura…). */
export const aceitaProduto = (colunas: string[]) =>
  colunas.some((c) => /^codigo/.test(norm(c))) && colunas.some((c) => /^descri/.test(norm(c)));

/** Monta a linha: código e descrição do catálogo, quantidade 1 e o resto em branco para o especialista. */
export function linhaDoProduto(colunas: string[], produto: { codigo: string; nome: string }): Linha {
  return {
    celulas: colunas.map((c) => {
      const n = norm(c);
      if (/^codigo/.test(n)) return produto.codigo;
      if (/^descri/.test(n)) return produto.nome;
      if (/^(qtd|quant)/.test(n)) return "1";
      return "";
    }),
  };
}

/** Acrescenta o produto; se a tabela só tem a linha em branco de preenchimento, usa essa linha. */
export function inserirProduto(linhas: Linha[], colunas: string[], produto: { codigo: string; nome: string }): Linha[] {
  const nova = linhaDoProduto(colunas, produto);
  const soEmBranco = linhas.length > 0 && linhas.every((l) => l.celulas.every((c) => !c.trim()));
  return soEmBranco ? [...linhas.slice(0, -1), nova] : [...linhas, nova];
}

/** Qual coluna dispara a busca no catálogo ao digitar: "Código" ou "Descrição". */
export function colunaDeBusca(coluna: string): "codigo" | "descricao" | null {
  const n = norm(coluna);
  if (/^codigo/.test(n)) return "codigo";
  if (/^descri/.test(n)) return "descricao";
  return null;
}

/** Aplica o produto escolhido na linha digitada: troca código e descrição, mantém o resto e põe quantidade 1 se vazia. */
export function aplicarProdutoNaLinha(linha: Linha, colunas: string[], produto: { codigo: string; nome: string }): Linha {
  const celulas = colunas.map((c, j) => {
    const atual = linha.celulas[j] ?? "";
    const n = norm(c);
    if (/^codigo/.test(n)) return produto.codigo;
    if (/^descri/.test(n)) return produto.nome;
    if (/^(qtd|quant)/.test(n)) return atual.trim() ? atual : "1";
    return atual;
  });
  return { ...linha, celulas };
}

/** Remove só a coluna `indice` (e a célula correspondente de cada linha); a tabela nunca fica sem coluna. */
export function removerColuna<T extends { celulas: string[] }>(colunas: string[], linhas: T[], indice: number) {
  if (colunas.length <= 1 || indice < 0 || indice >= colunas.length) return { colunas, linhas };
  return {
    colunas: colunas.filter((_, j) => j !== indice),
    linhas: linhas.map((l) => ({ ...l, celulas: l.celulas.filter((_, j) => j !== indice) })),
  };
}

export type ModeloTabelaProduto = "produtos" | "materiais";

/** Tabelas prontas, já com Código e Descrição (a busca no catálogo funciona nelas) e uma linha em branco. */
export const MODELOS_TABELA_PRODUTO: Record<ModeloTabelaProduto, { titulo: string; colunas: string[] }> = {
  produtos: { titulo: "Produtos IONICS", colunas: ["Código", "Descrição", "Qtd."] },
  materiais: { titulo: "Materiais de infraestrutura", colunas: ["Código", "Descrição", "Aplicação", "Un.", "Qtd."] },
};
