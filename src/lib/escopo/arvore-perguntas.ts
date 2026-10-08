// Monta a árvore Posto › Ilha › Bomba › Bico (+ comboios, frota) com as perguntas
// de cada entidade e o progresso por entidade. Código puro (client-safe), usado
// pelo checklist do agente e pela tela de revisão.
import type { EntidadeEscopo, TipoEntidade } from "./tipos";

export type Contagem = { total: number; respondidas: number };

export type NoArvore<P> = {
  entidade: EntidadeEscopo;
  /** Ancestrais, do mais alto ao mais próximo (sem a própria entidade). */
  ancestrais: EntidadeEscopo[];
  /** Perguntas desta entidade que estão no conjunto renderizado (ex.: a seção atual). */
  perguntas: P[];
  filhos: NoArvore<P>[];
  /** Progresso da entidade + descendentes, considerando o formulário inteiro. */
  contagem: Contagem;
};

export type GrupoArvore<P> = {
  chave: "pista" | "comboios" | "frota" | "outros";
  titulo: string;
  nos: NoArvore<P>[];
};

const TITULO_GRUPO: Record<GrupoArvore<unknown>["chave"], string> = {
  pista: "Pista",
  comboios: "Comboios",
  frota: "Frota / DIV",
  outros: "Outros",
};

function grupoDoTipo(tipo: TipoEntidade): GrupoArvore<unknown>["chave"] {
  if (tipo === "posto" || tipo === "ilha" || tipo === "bomba" || tipo === "bico") return "pista";
  if (tipo === "comboio") return "comboios";
  if (tipo === "frota") return "frota";
  return "outros";
}

const porOrdem = (a: EntidadeEscopo, b: EntidadeEscopo) => a.ordem - b.ordem;

/**
 * Progresso por entidade (própria + descendentes) a partir de TODAS as perguntas
 * visíveis do formulário. Ex.: "Bomba 02 — 3 de 7 respondidas".
 */
export function contarPorEntidade<P>(
  entidades: EntidadeEscopo[],
  visiveis: P[],
  entidadeId: (p: P) => string | null | undefined,
  respondida: (p: P) => boolean,
): Map<string, Contagem> {
  const proprio = new Map<string, Contagem>();
  for (const p of visiveis) {
    const id = entidadeId(p);
    if (!id) continue;
    const c = proprio.get(id) ?? { total: 0, respondidas: 0 };
    c.total += 1;
    if (respondida(p)) c.respondidas += 1;
    proprio.set(id, c);
  }
  const filhosDe = new Map<string | null, EntidadeEscopo[]>();
  for (const e of entidades) {
    const arr = filhosDe.get(e.parent_id) ?? [];
    arr.push(e);
    filhosDe.set(e.parent_id, arr);
  }
  const agregado = new Map<string, Contagem>();
  const somar = (e: EntidadeEscopo): Contagem => {
    const base = proprio.get(e.id) ?? { total: 0, respondidas: 0 };
    const c = { total: base.total, respondidas: base.respondidas };
    for (const f of filhosDe.get(e.id) ?? []) {
      const s = somar(f);
      c.total += s.total;
      c.respondidas += s.respondidas;
    }
    agregado.set(e.id, c);
    return c;
  };
  for (const raiz of filhosDe.get(null) ?? []) somar(raiz);
  return agregado;
}

/**
 * Separa as perguntas gerais (topo) da árvore de entidades. Só entram os nós que
 * têm perguntas no conjunto ou descendentes com perguntas.
 */
export function montarArvore<P>(
  entidades: EntidadeEscopo[],
  perguntas: P[],
  entidadeId: (p: P) => string | null | undefined,
  contagem: Map<string, Contagem>,
): { gerais: P[]; grupos: GrupoArvore<P>[] } {
  const gerais: P[] = [];
  const porEntidade = new Map<string, P[]>();
  for (const p of perguntas) {
    const id = entidadeId(p);
    if (!id) {
      gerais.push(p);
      continue;
    }
    const arr = porEntidade.get(id) ?? [];
    arr.push(p);
    porEntidade.set(id, arr);
  }

  const porId = new Map(entidades.map((e) => [e.id, e]));
  const filhosDe = new Map<string | null, EntidadeEscopo[]>();
  for (const e of entidades) {
    const arr = filhosDe.get(e.parent_id) ?? [];
    arr.push(e);
    filhosDe.set(e.parent_id, arr);
  }

  const ancestraisDe = (e: EntidadeEscopo): EntidadeEscopo[] => {
    const out: EntidadeEscopo[] = [];
    let cur = e.parent_id ? porId.get(e.parent_id) : undefined;
    while (cur) {
      out.unshift(cur);
      cur = cur.parent_id ? porId.get(cur.parent_id) : undefined;
    }
    return out;
  };

  const construir = (e: EntidadeEscopo): NoArvore<P> | null => {
    const filhos = (filhosDe.get(e.id) ?? [])
      .slice()
      .sort(porOrdem)
      .map(construir)
      .filter((n): n is NoArvore<P> => n !== null);
    const proprias = porEntidade.get(e.id) ?? [];
    if (!proprias.length && !filhos.length) return null;
    return {
      entidade: e,
      ancestrais: ancestraisDe(e),
      perguntas: proprias,
      filhos,
      contagem: contagem.get(e.id) ?? { total: 0, respondidas: 0 },
    };
  };

  const grupos = new Map<GrupoArvore<P>["chave"], GrupoArvore<P>>();
  for (const raiz of (filhosDe.get(null) ?? []).slice().sort(porOrdem)) {
    const no = construir(raiz);
    if (!no) continue;
    const chave = grupoDoTipo(raiz.tipo);
    const g = grupos.get(chave) ?? { chave, titulo: TITULO_GRUPO[chave], nos: [] };
    g.nos.push(no);
    grupos.set(chave, g);
  }
  const ordem: GrupoArvore<P>["chave"][] = ["pista", "comboios", "frota", "outros"];
  return { gerais, grupos: ordem.map((k) => grupos.get(k)).filter((g): g is GrupoArvore<P> => !!g) };
}
