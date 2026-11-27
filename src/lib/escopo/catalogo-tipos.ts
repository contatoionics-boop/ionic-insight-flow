// Catálogo dos tipos de item do Escopo (Posto, Comboio, Sonda… e os criados pela tela
// "Tipos de item", como Prédio ou Produto). Código puro (client-safe).
//
// Os tipos do sistema têm chave fixa (a estrutura, as respostas e o documento dependem dela): só o
// nome exibido e a visibilidade mudam. Os tipos novos são itens simples (quantidade + identificação
// opcional), guardados em `ArvoreEscopo.extras[chave]`.
//
// Sem a tabela `escopo_tipos` no banco (migration pendente) vale o catálogo padrão abaixo.

export type TipoCatalogo = {
  chave: string;
  rotulo: string;
  plural: string;
  ativo: boolean;
  /** tipo que já vem com o sistema: não se exclui nem muda a chave */
  sistema: boolean;
  ordem: number;
};

export const SLUG_TIPO = /^[a-z][a-z0-9_]{1,40}$/;

export const TIPOS_SISTEMA: TipoCatalogo[] = [
  { chave: "posto", rotulo: "Posto", plural: "Postos", ativo: true, sistema: true, ordem: 10 },
  { chave: "ilha", rotulo: "Ilha", plural: "Ilhas", ativo: true, sistema: true, ordem: 11 },
  { chave: "bomba", rotulo: "Bomba", plural: "Bombas", ativo: true, sistema: true, ordem: 12 },
  { chave: "bico", rotulo: "Bico", plural: "Bicos", ativo: true, sistema: true, ordem: 13 },
  { chave: "comboio", rotulo: "Comboio", plural: "Comboios", ativo: true, sistema: true, ordem: 20 },
  { chave: "tanque", rotulo: "Tanque", plural: "Tanques do comboio", ativo: true, sistema: true, ordem: 21 },
  { chave: "tanque_lubrificante", rotulo: "Tanque lubrificante", plural: "Tanques com lubrificante", ativo: true, sistema: true, ordem: 30 },
  { chave: "sonda", rotulo: "Sonda", plural: "Tanques com medidores", ativo: true, sistema: true, ordem: 40 },
  { chave: "frota", rotulo: "Frota / DIV", plural: "Frota / DIV", ativo: true, sistema: true, ordem: 50 },
];

/** Tipos do sistema que têm seção própria no Escopo (podem ser ocultados). Os demais são filhos (ilha, bomba, bico, tanque do comboio). */
export const RAIZES_SISTEMA = ["posto", "comboio", "tanque_lubrificante", "sonda", "frota"] as const;

const CHAVES_SISTEMA = new Set(TIPOS_SISTEMA.map((t) => t.chave));
/** Chaves que um tipo novo não pode usar (já têm outro significado no sistema). */
const RESERVADAS = new Set([...CHAVES_SISTEMA, "geral", "div", "pista", "extras", "outros", "postos", "comboios", "sondas", "tanques", "config", "frota_itens"]);

export const ehTipoDoSistema = (chave: string) => CHAVES_SISTEMA.has(chave);
export const ehChaveValida = (chave: string) => SLUG_TIPO.test(chave) && !RESERVADAS.has(chave);

/** Só os tipos com seção própria (raízes do sistema e os novos) podem ser ocultados. */
export const podeOcultarTipo = (chave: string) => !CHAVES_SISTEMA.has(chave) || (RAIZES_SISTEMA as readonly string[]).includes(chave);

const texto = (v: unknown, max = 80) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Junta o catálogo padrão com as linhas do banco. Tipo do sistema: vale o nome/visibilidade/ordem do banco
 * (campo vazio volta ao padrão). Tipo novo: precisa de chave válida e não reservada.
 */
export function mesclarCatalogo(linhas?: Partial<TipoCatalogo>[] | null): TipoCatalogo[] {
  const porChave = new Map<string, TipoCatalogo>(TIPOS_SISTEMA.map((t) => [t.chave, { ...t }]));
  for (const l of linhas ?? []) {
    const chave = texto(l?.chave, 41);
    if (!chave) continue;
    const base = porChave.get(chave);
    if (base) {
      porChave.set(chave, {
        ...base,
        rotulo: texto(l.rotulo) || base.rotulo,
        plural: texto(l.plural) || base.plural,
        // tipos filhos (ilha, bomba…) nunca ficam ocultos
        ativo: podeOcultarTipo(chave) ? l.ativo !== false : true,
        ordem: Number.isFinite(l.ordem) ? Number(l.ordem) : base.ordem,
      });
    } else if (ehChaveValida(chave) && texto(l.rotulo)) {
      const rotulo = texto(l.rotulo);
      porChave.set(chave, {
        chave,
        rotulo,
        plural: texto(l.plural) || rotulo,
        ativo: l.ativo !== false,
        sistema: false,
        ordem: Number.isFinite(l.ordem) ? Number(l.ordem) : 100,
      });
    }
  }
  return [...porChave.values()].sort((a, b) => a.ordem - b.ordem || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

export const CATALOGO_PADRAO: TipoCatalogo[] = mesclarCatalogo();

type Cat = TipoCatalogo[] | null | undefined;
const achar = (cat: Cat, chave: string) => (cat ?? CATALOGO_PADRAO).find((t) => t.chave === chave);

/** "Prédio"; tipo desconhecido (removido) mostra a própria chave. */
export const rotuloDoTipo = (cat: Cat, chave: string): string => achar(cat, chave)?.rotulo ?? chave;
export const pluralDoTipo = (cat: Cat, chave: string): string => achar(cat, chave)?.plural ?? chave;

/** chave do tipo → plural configurado (títulos dos grupos de tipos novos nas listas de perguntas) */
export const titulosDosTipos = (cat: Cat): Record<string, string> =>
  Object.fromEntries((cat ?? CATALOGO_PADRAO).map((t) => [t.chave, t.plural]));

/** Tipos novos (itens simples) ativos, na ordem do catálogo. */
export const tiposNovosAtivos = (cat: Cat): TipoCatalogo[] => (cat ?? CATALOGO_PADRAO).filter((t) => !t.sistema && t.ativo);

/** Todos os tipos novos (inclusive ocultos): base para ler o que já está cadastrado. */
export const tiposNovos = (cat: Cat): TipoCatalogo[] => (cat ?? CATALOGO_PADRAO).filter((t) => !t.sistema);

/** A seção do tipo aparece no Escopo? (ativo, ou já tem itens cadastrados: nunca esconde dado existente). */
export const tipoVisivel = (cat: Cat, chave: string, qtdAtual: number): boolean => qtdAtual > 0 || (achar(cat, chave)?.ativo ?? true);

/** Gera a chave de um tipo novo a partir do nome ("Prédio" → "predio"), sem repetir as já usadas. */
export function slugDoNome(nome: string, usadas: Iterable<string>): string {
  const base =
    nome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/^[0-9_]+/, "")
      .slice(0, 30) || "item";
  const ocupadas = new Set(usadas);
  const livre = (c: string) => ehChaveValida(c) && !ocupadas.has(c);
  let chave = base.length < 2 ? `${base}_item` : base;
  if (livre(chave)) return chave;
  for (let i = 2; i < 1000; i++) {
    chave = `${base}_${i}`;
    if (livre(chave)) return chave;
  }
  return `${base}_${Date.now().toString(36)}`.slice(0, 41);
}

/** Opções de "Aplica-se a" das perguntas. Tipos ocultos saem, exceto os que `manter` pede (valor já gravado). */
export function opcoesAplicaA(cat: Cat, manter: string[] = []): { value: string; label: string }[] {
  const c = cat ?? CATALOGO_PADRAO;
  const visivel = (chave: string) => manter.includes(chave) || (achar(c, chave)?.ativo ?? true);
  // nomes mais claros para o formulário, enquanto o tipo não for renomeado
  const LONGO: Record<string, string> = { tanque: "Tanque do comboio", tanque_lubrificante: "Tanque com lubrificante" };
  const lab = (chave: string) => {
    const atual = rotuloDoTipo(c, chave);
    return LONGO[chave] && atual === rotuloDoTipo(CATALOGO_PADRAO, chave) ? LONGO[chave] : atual;
  };
  const fixas: { value: string; label: string }[] = [
    { value: "geral", label: "Geral (uma vez)" },
    { value: "posto", label: lab("posto") },
    { value: "ilha", label: lab("ilha") },
    { value: "bomba", label: lab("bomba") },
    { value: "bico", label: lab("bico") },
    { value: "comboio", label: lab("comboio") },
    { value: "frota", label: "Frota" },
    { value: "div", label: "DIV" },
    { value: "sonda", label: lab("sonda") },
    { value: "tanque", label: lab("tanque") },
    { value: "tanque_lubrificante", label: lab("tanque_lubrificante") },
  ];
  const novas = tiposNovos(c).map((t) => ({ value: t.chave, label: t.rotulo }));
  return [...fixas, ...novas].filter((o) => o.value === "geral" || o.value === "div" || visivel(o.value === "frota" ? "frota" : o.value));
}

/** Itens do escopo que podem fazer um formulário ser sugerido no agendamento ("pista" = posto). */
export function opcoesSugerir(cat: Cat, manter: string[] = []): { value: string; label: string }[] {
  const c = cat ?? CATALOGO_PADRAO;
  const visivel = (chave: string) => manter.includes(chave) || (achar(c, chave)?.ativo ?? true);
  const base: { value: string; label: string; tipo: string }[] = [
    { value: "pista", label: "Pista (posto)", tipo: "posto" },
    { value: "comboio", label: rotuloDoTipo(c, "comboio"), tipo: "comboio" },
    { value: "tanque_lubrificante", label: rotuloDoTipo(c, "tanque_lubrificante") === "Tanque lubrificante" ? "Tanque com lubrificante" : rotuloDoTipo(c, "tanque_lubrificante"), tipo: "tanque_lubrificante" },
    { value: "sonda", label: rotuloDoTipo(c, "sonda"), tipo: "sonda" },
    { value: "frota", label: "Frota / DIV", tipo: "frota" },
  ];
  const novas = tiposNovos(c).map((t) => ({ value: t.chave, label: t.rotulo, tipo: t.chave }));
  return [...base, ...novas].filter((o) => visivel(o.value === "pista" ? "posto" : o.tipo)).map(({ value, label }) => ({ value, label }));
}
