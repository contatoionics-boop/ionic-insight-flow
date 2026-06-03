export type UnidadeRef = {
  nome: string | null;
  matriz?: { nome: string | null; empresa?: { nome: string | null } | null } | null;
} | null;

export function empresaNome(u: UnidadeRef): string {
  return u?.matriz?.empresa?.nome ?? u?.matriz?.nome ?? u?.nome ?? "—";
}

export function unidadeLabel(u: UnidadeRef): string {
  const e = u?.matriz?.empresa?.nome;
  const un = u?.nome;
  if (e && un) return `${e} · ${un}`;
  return e ?? un ?? "—";
}

export const unidadeSelectFragment =
  "unidade:unidades(nome, matriz:matrizes(nome, empresa:empresas(nome)))";
