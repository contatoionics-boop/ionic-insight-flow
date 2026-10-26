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
