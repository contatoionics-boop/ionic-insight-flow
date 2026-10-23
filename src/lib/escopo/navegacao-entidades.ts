// Navegação do preenchimento orientada por equipamento (Bomba, Comboio...).
// Código puro (client-safe): recebe as entidades do Escopo e as perguntas visíveis
// já avaliadas (condicionais, respondida, obrigatória atendida) e devolve as
// "unidades de trabalho" com estado e progresso. Não conhece UI nem servidor.
import type { EntidadeEscopo, TipoEntidade } from "./tipos";

export type EstadoEquip = "nao_iniciada" | "em_andamento" | "concluida" | "com_pendencias";

/** Pergunta visível reduzida ao que a navegação precisa. */
export type ItemNav = {
  id: string;
  entidadeId: string | null;
  obrigatoria: boolean;
  respondida: boolean;
  /** Obrigatória atendida (ou pergunta não obrigatória). */
  completa: boolean;
  texto: string;
  /** Texto respondido (para achar o nome real do equipamento). */
  valor: string;
  etapaId: string;
  etapaTitulo: string;
  etapaOrdem: number;
};

export type Progresso = {
  total: number;
  respondidas: number;
  obrigatoriasTotal: number;
  obrigatoriasFaltando: number;
};

export type SubEntidade = {
  entidade: EntidadeEscopo;
  /** Perguntas desta sub-entidade (ex.: Bico 01 dentro da Bomba 02). */
  itens: ItemNav[];
};

export type Unidade = Progresso & {
  /** Id da entidade (chave da navegação); "<id>:dados" para os dados do próprio posto/ilha. */
  id: string;
  entidade: EntidadeEscopo;
  ancestrais: EntidadeEscopo[];
  /** Unidade só com os dados do próprio posto/ilha (sem equipamentos filhos). */
  soProprias: boolean;
  /** "Bomba 02" ou "Dados da Ilha 01". */
  titulo: string;
  /** Identificação real respondida (ex.: "Wayne Helix 6000"), se houver. */
  nomeReal: string | null;
  /** "Bomba 02 — Wayne Helix 6000" ou só o rótulo. */
  tituloCompleto: string;
  proprias: ItemNav[];
  subs: SubEntidade[];
  /** Todas as perguntas da unidade (próprias + sub-entidades). */
  itens: ItemNav[];
  marcada: boolean;
  estado: EstadoEquip;
};

export type Geral = Progresso & { itens: ItemNav[]; estado: EstadoEquip };

export type NoPista = {
  posto: EntidadeEscopo;
  dados: Unidade | null;
  ilhas: { ilha: EntidadeEscopo; dados: Unidade | null; equipamentos: Unidade[] }[];
  /** Equipamentos ligados direto ao posto (sem ilha). */
  diretos: Unidade[];
};

export type ModeloNav = {
  geral: Geral | null;
  pista: NoPista[];
  comboios: Unidade[];
  tanques: Unidade[];
  sondas: Unidade[];
  frota: Unidade[];
  outros: Unidade[];
  porId: Map<string, Unidade>;
  /** Sequência de navegação "próximo equipamento" de cada tipo (ex.: todas as bombas). */
  sequencia: (tipo: TipoEntidade) => Unidade[];
  /** Próximo equipamento do mesmo tipo (segue para a próxima ilha), ou null no último. */
  proxima: (id: string) => Unidade | null;
};

const porOrdem = (a: EntidadeEscopo, b: EntidadeEscopo) => a.ordem - b.ordem;

/** Remove acentos e baixa a caixa para comparar textos. */
function normalizar(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

const RE_MODELO = /\b(modelo|marca|fabricante)\b/;
const RE_IDENT = /\b(placa|identificacao|identificador|prefixo)\b/;

/** Identificação real do equipamento a partir das respostas das próprias perguntas. */
export function nomeRealDe(proprias: ItemNav[]): string | null {
  const util = (i: ItemNav) => {
    const v = i.valor.trim();
    return v.length > 0 && v.length <= 60 && !/^(sim|nao|não)$/i.test(v) && !/^\d{4}-\d{2}-\d{2}/.test(v);
  };
  for (const re of [RE_MODELO, RE_IDENT]) {
    const achado = proprias.find((i) => i.respondida && util(i) && re.test(normalizar(i.texto)));
    if (achado) return achado.valor.trim();
  }
  return null;
}

/**
 * Estado do equipamento. A conclusão é principalmente automática (obrigatórias
 * atendidas); a marcação manual só reforça. "Com pendências" aparece quando há
 * obrigatória faltando e o técnico já tentou concluir (marcou ou tentou avançar).
 */
export function estadoDe(p: Progresso, marcada: boolean, tentou: boolean): EstadoEquip {
  if (p.respondidas === 0 && !marcada) return "nao_iniciada";
  if (p.obrigatoriasFaltando > 0) return marcada || tentou ? "com_pendencias" : "em_andamento";
  if (p.obrigatoriasTotal > 0) return "concluida";
  return marcada || p.respondidas >= p.total ? "concluida" : "em_andamento";
}

export function progressoDe(itens: ItemNav[]): Progresso {
  const obrig = itens.filter((i) => i.obrigatoria);
  return {
    total: itens.length,
    respondidas: itens.filter((i) => i.respondida).length,
    obrigatoriasTotal: obrig.length,
    obrigatoriasFaltando: obrig.filter((i) => !i.completa).length,
  };
}

/** Quantos equipamentos de uma lista estão em cada estado ("4 de 7 bombas concluídas"). */
export function contarEstados(unidades: Pick<Unidade, "estado">[]) {
  const c = { total: unidades.length, concluidas: 0, emAndamento: 0, pendencias: 0, naoIniciadas: 0 };
  for (const u of unidades) {
    if (u.estado === "concluida") c.concluidas++;
    else if (u.estado === "em_andamento") c.emAndamento++;
    else if (u.estado === "com_pendencias") c.pendencias++;
    else c.naoIniciadas++;
  }
  return c;
}

export function montarNavegacao(
  entidades: EntidadeEscopo[],
  itens: ItemNav[],
  opts: { concluidas?: ReadonlySet<string>; tentaram?: ReadonlySet<string> } = {},
): ModeloNav {
  const concluidas = opts.concluidas ?? new Set<string>();
  const tentaram = opts.tentaram ?? new Set<string>();

  const porEntidade = new Map<string, ItemNav[]>();
  const gerais: ItemNav[] = [];
  for (const i of itens) {
    if (!i.entidadeId) {
      gerais.push(i);
      continue;
    }
    const arr = porEntidade.get(i.entidadeId) ?? [];
    arr.push(i);
    porEntidade.set(i.entidadeId, arr);
  }

  const porId = new Map(entidades.map((e) => [e.id, e]));
  const filhosDe = new Map<string | null, EntidadeEscopo[]>();
  for (const e of entidades) {
    const arr = filhosDe.get(e.parent_id) ?? [];
    arr.push(e);
    filhosDe.set(e.parent_id, arr);
  }
  for (const arr of filhosDe.values()) arr.sort(porOrdem);

  const ancestraisDe = (e: EntidadeEscopo): EntidadeEscopo[] => {
    const out: EntidadeEscopo[] = [];
    let cur = e.parent_id ? porId.get(e.parent_id) : undefined;
    while (cur) {
      out.unshift(cur);
      cur = cur.parent_id ? porId.get(cur.parent_id) : undefined;
    }
    return out;
  };

  const descendentes = (e: EntidadeEscopo): EntidadeEscopo[] => {
    const out: EntidadeEscopo[] = [];
    for (const f of filhosDe.get(e.id) ?? []) out.push(f, ...descendentes(f));
    return out;
  };

  const unidades = new Map<string, Unidade>();

  const criarUnidade = (e: EntidadeEscopo, soProprias: boolean): Unidade | null => {
    const proprias = porEntidade.get(e.id) ?? [];
    const subs: SubEntidade[] = soProprias
      ? []
      : descendentes(e)
          .map((d) => ({ entidade: d, itens: porEntidade.get(d.id) ?? [] }))
          .filter((s) => s.itens.length > 0);
    const todos = [...proprias, ...subs.flatMap((s) => s.itens)];
    if (todos.length === 0) return null;
    const prog = progressoDe(todos);
    const marcada = concluidas.has(e.id);
    const nomeReal = soProprias ? null : nomeRealDe(proprias);
    const titulo = soProprias ? `Dados ${e.tipo === "ilha" ? "da" : "do"} ${e.rotulo}` : e.rotulo;
    const u: Unidade = {
      ...prog,
      id: soProprias ? `${e.id}:dados` : e.id,
      entidade: e,
      ancestrais: ancestraisDe(e),
      soProprias,
      titulo,
      nomeReal,
      tituloCompleto: nomeReal ? `${titulo} — ${nomeReal}` : titulo,
      proprias,
      subs,
      itens: todos,
      marcada,
      estado: estadoDe(prog, marcada, tentaram.has(e.id)),
    };
    unidades.set(u.id, u);
    return u;
  };

  const raizes = filhosDe.get(null) ?? [];
  const pista: NoPista[] = [];
  const comboios: Unidade[] = [];
  const tanques: Unidade[] = [];
  const sondas: Unidade[] = [];
  const frota: Unidade[] = [];
  const outros: Unidade[] = [];

  for (const raiz of raizes) {
    if (raiz.tipo === "posto") {
      const no: NoPista = { posto: raiz, dados: criarUnidade(raiz, true), ilhas: [], diretos: [] };
      for (const f of filhosDe.get(raiz.id) ?? []) {
        if (f.tipo === "ilha") {
          const equipamentos = (filhosDe.get(f.id) ?? [])
            .map((b) => criarUnidade(b, false))
            .filter((u): u is Unidade => !!u);
          no.ilhas.push({ ilha: f, dados: criarUnidade(f, true), equipamentos });
        } else {
          const u = criarUnidade(f, false);
          if (u) no.diretos.push(u);
        }
      }
      pista.push(no);
      continue;
    }
    const u = criarUnidade(raiz, false);
    if (!u) continue;
    if (raiz.tipo === "comboio") comboios.push(u);
    else if (raiz.tipo === "tanque_lubrificante") tanques.push(u);
    else if (raiz.tipo === "sonda") sondas.push(u);
    else if (raiz.tipo === "frota") frota.push(u);
    else outros.push(u);
  }

  const geral: Geral | null = gerais.length
    ? (() => {
        const prog = progressoDe(gerais);
        return { ...prog, itens: gerais, estado: estadoDe(prog, false, false) };
      })()
    : null;

  // Sequência de "próximo equipamento": todas as bombas (posto › ilha › bomba), comboios etc.
  const sequencias = new Map<TipoEntidade, Unidade[]>();
  const empurrar = (u: Unidade) => {
    const arr = sequencias.get(u.entidade.tipo) ?? [];
    arr.push(u);
    sequencias.set(u.entidade.tipo, arr);
  };
  for (const no of pista) {
    for (const u of no.diretos) empurrar(u);
    for (const il of no.ilhas) for (const u of il.equipamentos) empurrar(u);
  }
  for (const grupo of [comboios, tanques, sondas, frota]) for (const u of grupo) empurrar(u);

  const sequencia = (tipo: TipoEntidade) => sequencias.get(tipo) ?? [];
  const proxima = (id: string) => {
    const u = unidades.get(id);
    if (!u) return null;
    const seq = sequencia(u.entidade.tipo);
    const idx = seq.findIndex((x) => x.id === id);
    return idx >= 0 && idx < seq.length - 1 ? seq[idx + 1] : null;
  };

  return { geral, pista, comboios, tanques, sondas, frota, outros, porId: unidades, sequencia, proxima };
}
