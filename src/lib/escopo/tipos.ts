// Modelo da estrutura física do Escopo. Código puro (client-safe): a interface
// (accordion hoje, wizard no futuro) só produz/edita uma `ArvoreEscopo`; o motor
// de geração e o banco nunca conhecem a interface.

export type TipoEntidade =
  | "posto"
  | "ilha"
  | "bomba"
  | "bico"
  | "comboio"
  | "frota"
  | "sonda"
  | "tanque";

/** Valores de `perguntas.entidade_tipo` (aplicabilidade da pergunta). */
export type AplicaA =
  | "geral"
  | "posto"
  | "ilha"
  | "bomba"
  | "bico"
  | "comboio"
  | "frota"
  | "div"
  | "sonda"
  | "tanque";

export const APLICA_A_OPCOES: { value: AplicaA; label: string }[] = [
  { value: "geral", label: "Geral (uma vez)" },
  { value: "posto", label: "Posto" },
  { value: "ilha", label: "Ilha" },
  { value: "bomba", label: "Bomba" },
  { value: "bico", label: "Bico" },
  { value: "comboio", label: "Comboio" },
  { value: "frota", label: "Frota" },
  { value: "div", label: "DIV" },
];

/** Tipo de entidade do Escopo em que cada aplicabilidade se repete. */
export function tipoEntidadeDaAplicacao(a: string | null | undefined): TipoEntidade | null {
  switch (a) {
    case "posto":
    case "ilha":
    case "bomba":
    case "bico":
    case "comboio":
    case "sonda":
    case "tanque":
      return a;
    case "frota":
    case "div":
      return "frota";
    default:
      return null;
  }
}

export type BombaArvore = { bicos: number };
export type IlhaArvore = { bombas: BombaArvore[] };
export type PostoArvore = { ilhas: IlhaArvore[] };
export type FrotaItemArvore = { modelo: string; quantidade: number; info?: string };

export type ConfigEscopo = {
  solucao?: string | null;
  comunicacao?: "wifi" | "4g" | "ambos" | null;
};

export type ArvoreEscopo = {
  postos: PostoArvore[];
  comboios: number;
  frota: { ativo: boolean; itens: FrotaItemArvore[] };
  config: ConfigEscopo;
};

export const arvoreVazia = (): ArvoreEscopo => ({
  postos: [],
  comboios: 0,
  frota: { ativo: false, itens: [] },
  config: {},
});

export const LIMITES = { postos: 20, ilhas: 30, bombas: 30, bicos: 12, comboios: 50 } as const;

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export const ROTULO_TIPO: Record<TipoEntidade, string> = {
  posto: "Posto",
  ilha: "Ilha",
  bomba: "Bomba",
  bico: "Bico",
  comboio: "Comboio",
  frota: "Frota / DIV",
  sonda: "Sonda",
  tanque: "Tanque",
};

export function rotuloEntidade(tipo: TipoEntidade, ordem: number) {
  return tipo === "frota" ? ROTULO_TIPO.frota : `${ROTULO_TIPO[tipo]} ${pad2(ordem)}`;
}

export type EntidadeEscopo = {
  id: string;
  tipo: TipoEntidade;
  parent_id: string | null;
  ordem: number;
  rotulo: string;
  ativo?: boolean;
};

/** Reconstrói a árvore editável a partir das entidades ativas (lista plana). */
export function arvoreDeEntidades(
  entidades: EntidadeEscopo[],
  frotaItens: FrotaItemArvore[] = [],
  config: ConfigEscopo = {},
): ArvoreEscopo {
  const filhos = (parent: string | null, tipo: TipoEntidade) =>
    entidades
      .filter((e) => e.tipo === tipo && e.parent_id === parent)
      .sort((a, b) => a.ordem - b.ordem);
  const postos = filhos(null, "posto").map((p) => ({
    ilhas: filhos(p.id, "ilha").map((i) => ({
      bombas: filhos(i.id, "bomba").map((b) => ({ bicos: filhos(b.id, "bico").length })),
    })),
  }));
  return {
    postos,
    comboios: filhos(null, "comboio").length,
    frota: { ativo: entidades.some((e) => e.tipo === "frota"), itens: frotaItens },
    config,
  };
}

/** Normaliza (limites, inteiros ≥ 0) uma árvore vinda da interface. */
export function normalizarArvore(a: ArvoreEscopo): ArvoreEscopo {
  const n = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
  return {
    postos: (a.postos ?? []).slice(0, LIMITES.postos).map((p) => ({
      ilhas: (p.ilhas ?? []).slice(0, LIMITES.ilhas).map((i) => ({
        bombas: (i.bombas ?? []).slice(0, LIMITES.bombas).map((b) => ({
          bicos: n(b.bicos, LIMITES.bicos),
        })),
      })),
    })),
    comboios: n(a.comboios, LIMITES.comboios),
    frota: {
      ativo: !!a.frota?.ativo,
      itens: (a.frota?.itens ?? [])
        .filter((it) => it.modelo?.trim())
        .map((it) => ({
          modelo: it.modelo.trim(),
          quantidade: Math.max(1, Math.floor(Number(it.quantidade) || 1)),
          info: it.info?.trim() || undefined,
        })),
    },
    config: a.config ?? {},
  };
}

export function resumoArvore(a: ArvoreEscopo) {
  let ilhas = 0;
  let bombas = 0;
  let bicos = 0;
  for (const p of a.postos) {
    ilhas += p.ilhas.length;
    for (const i of p.ilhas) {
      bombas += i.bombas.length;
      for (const b of i.bombas) bicos += b.bicos;
    }
  }
  return { postos: a.postos.length, ilhas, bombas, bicos, comboios: a.comboios, frota: a.frota.ativo };
}

/** Item "desejado" (nível plano) gerado a partir da árvore, com caminho por índices. */
export type EntidadeDesejada = {
  chave: string; // ex.: "posto:1/ilha:2/bomba:1"
  tipo: TipoEntidade;
  paiChave: string | null;
  ordem: number;
  rotulo: string;
};

/** Achata a árvore em entidades desejadas (ordem de criação: pais antes dos filhos). */
export function entidadesDesejadas(a: ArvoreEscopo): EntidadeDesejada[] {
  const out: EntidadeDesejada[] = [];
  const add = (tipo: TipoEntidade, paiChave: string | null, ordem: number) => {
    const chave = `${paiChave ? paiChave + "/" : ""}${tipo}:${ordem}`;
    out.push({ chave, tipo, paiChave, ordem, rotulo: rotuloEntidade(tipo, ordem) });
    return chave;
  };
  a.postos.forEach((p, pi) => {
    const ck = add("posto", null, pi + 1);
    p.ilhas.forEach((il, ii) => {
      const ik = add("ilha", ck, ii + 1);
      il.bombas.forEach((b, bi) => {
        const bk = add("bomba", ik, bi + 1);
        for (let k = 1; k <= b.bicos; k++) add("bico", bk, k);
      });
    });
  });
  for (let c = 1; c <= a.comboios; c++) add("comboio", null, c);
  if (a.frota.ativo) add("frota", null, 1);
  return out;
}
