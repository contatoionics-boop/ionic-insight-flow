// Ordenação por relevância dos produtos achados na busca (client-safe, função pura).

const sem = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Menor = mais relevante: começa com o texto digitado (0) · contém o texto seguido (1) ·
 * todas as palavras começam uma palavra do nome/código (2) · demais (3). Empate: ordem alfabética.
 */
export function ordenarPorRelevancia<T extends { codigo: string; nome: string }>(itens: T[], consulta: string): T[] {
  const q = sem(consulta);
  if (!q) return [...itens].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const termos = q.split(" ");
  const nota = (p: T) => {
    const nome = sem(p.nome);
    const codigo = sem(p.codigo);
    if (nome.startsWith(q) || codigo.startsWith(q)) return 0;
    if (nome.includes(q) || codigo.includes(q)) return 1;
    const palavras = `${nome} ${codigo}`.split(/[\s"'()/,-]+/);
    return termos.every((t) => palavras.some((w) => w.startsWith(t))) ? 2 : 3;
  };
  return [...itens].sort((a, b) => nota(a) - nota(b) || a.nome.localeCompare(b.nome, "pt-BR"));
}
