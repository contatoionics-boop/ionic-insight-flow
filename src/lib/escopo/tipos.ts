// Modelo da estrutura física do Escopo. Código puro (client-safe): a interface
// (accordion hoje, wizard no futuro) só produz/edita uma `ArvoreEscopo`; o motor
// de geração e o banco nunca conhecem a interface.
import { CATALOGO_PADRAO, SLUG_TIPO, ehChaveValida, rotuloDoTipo, type TipoCatalogo } from "./catalogo-tipos";

export type TipoEntidade =
  | "posto"
  | "ilha"
  | "bomba"
  | "bico"
  | "comboio"
  | "frota"
  | "sonda"
  /** Tanque do comboio (filho do comboio, como o bico é filho da bomba). */
  | "tanque"
  /** Tanque com lubrificante (raiz, independente da pista; tem formulário próprio). */
  | "tanque_lubrificante";

/** Chave de um tipo do sistema ou de um tipo novo criado em Configurações › Tipos de item (ex.: "predio"). */
export type TipoQualquer = TipoEntidade | (string & {});

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
  | "tanque"
  | "tanque_lubrificante";

export const APLICA_A_OPCOES: { value: AplicaA; label: string }[] = [
  { value: "geral", label: "Geral (uma vez)" },
  { value: "posto", label: "Posto" },
  { value: "ilha", label: "Ilha" },
  { value: "bomba", label: "Bomba" },
  { value: "bico", label: "Bico" },
  { value: "comboio", label: "Comboio" },
  { value: "frota", label: "Frota" },
  { value: "div", label: "DIV" },
  { value: "sonda", label: "Sonda" },
  { value: "tanque", label: "Tanque do comboio" },
  { value: "tanque_lubrificante", label: "Tanque com lubrificante" },
];

/** Tipo de entidade do Escopo em que cada aplicabilidade se repete. */
export function tipoEntidadeDaAplicacao(a: string | null | undefined): TipoQualquer | null {
  switch (a) {
    case "posto":
    case "ilha":
    case "bomba":
    case "bico":
    case "comboio":
    case "sonda":
    case "tanque":
    case "tanque_lubrificante":
      return a;
    case "frota":
    case "div":
      return "frota";
    default:
      // tipo novo (item simples criado em Tipos de item): a chave é o próprio valor
      return a && a !== "geral" && SLUG_TIPO.test(a) ? a : null;
  }
}

/** Itens de tipos novos que ficam DENTRO de um item (chave do tipo filho → itens), ex.: os andares de um prédio. */
export type FilhosArvore = Record<string, ItemEscopo[]>;
export type BombaArvore = { bicos: number; filhos?: FilhosArvore };
export type IlhaArvore = { bombas: BombaArvore[]; filhos?: FilhosArvore };
export type PostoArvore = { ilhas: IlhaArvore[]; filhos?: FilhosArvore };
export type FrotaItemArvore = { modelo: string; quantidade: number; info?: string };

/** Item de uma coleção independente (tanques, sondas). `nome` é a identificação opcional. */
export type ItemEscopo = { nome?: string; filhos?: FilhosArvore };

/** Solução contratada escolhida no agendamento. */
export type SolucaoEscopo = "ssg_frota" | "on_premise";
export const SOLUCOES_ESCOPO: { value: SolucaoEscopo; label: string }[] = [
  { value: "ssg_frota", label: "SSGFROTA" },
  { value: "on_premise", label: "On-premise" },
];

/** Itens do escopo que podem fazer um formulário ser sugerido no agendamento. */
export const SUGERIR_QUANDO_OPCOES = [
  { value: "pista", label: "Pista (posto)" },
  { value: "comboio", label: "Comboio" },
  { value: "tanque_lubrificante", label: "Tanque com lubrificante" },
  { value: "sonda", label: "Sonda" },
  { value: "frota", label: "Frota / DIV" },
] as const;
/** Chave de sugestão: as do sistema (pista, comboio…) ou a de um tipo novo. */
export type ChaveSugestao = string;

/** Quantidade de cada item do escopo (base para sugerir formulários e quantidades). Tipos novos entram pela própria chave. */
export function quantidadesDoEscopo(a: ArvoreEscopo): Record<ChaveSugestao, number> {
  return {
    ...contarItensExtras(a),
    pista: a.postos.length,
    comboio: a.comboios.length,
    tanque_lubrificante: (a.tanquesLubrificante ?? []).length,
    sonda: (a.sondas ?? []).length,
    frota: a.frota?.ativo ? 1 : 0,
  };
}

/** Cartão RFID: hoje só a quantidade. `tecnologia` fica vazia (versões antigas podem ter Mifare etc.). */
export type ItemRfid = { tecnologia: string; quantidade: number; info?: string };

/** Total de cartões RFID (soma dos itens). */
export function totalRfid(itens: ItemRfid[] | null | undefined): number {
  return (itens ?? []).reduce((s, i) => s + (Number(i.quantidade) || 0), 0);
}

/** "10 cartões" ou, em versões antigas com tecnologia, "20× Mifare, 5× Milexes". */
export function resumoRfid(itens: ItemRfid[] | null | undefined): string {
  const lista = itens ?? [];
  if (!lista.some((i) => i.tecnologia?.trim())) {
    const n = totalRfid(lista);
    return n ? `${n} ${n === 1 ? "cartão" : "cartões"}` : "";
  }
  return lista.map((i) => `${i.quantidade}× ${i.tecnologia?.trim() || "cartão"}`).join(", ");
}
export type ItemTx = { modelo: string; quantidade: number; info?: string };
export type ItemOutroDispositivo = { nome: string; modelo?: string; quantidade: number; info?: string };
/** Equipamento vendido (proposta comercial): vira a tabela "Produtos IONICS" do documento. */
export type ItemEquipamento = { codigo?: string; descricao: string; quantidade: number };

/**
 * Configuração da versão do Escopo. Dados de escopo (não geram perguntas por item):
 * solução, RFID, TX e outros dispositivos adicionados quando necessário.
 */
export type ConexaoDados = "wifi" | "4g" | "ambos";

/** Modelos de conexão de dados (o posto e o comboio podem usar modelos diferentes). */
export const CONEXOES_DADOS: { value: ConexaoDados; label: string }[] = [
  { value: "wifi", label: "Wi-Fi" },
  { value: "4g", label: "4G (GPRS/GSM)" },
  { value: "ambos", label: "Wi-Fi e 4G (GPRS/GSM)" },
];

export const ehConexaoDados = (v: unknown): v is ConexaoDados => v === "wifi" || v === "4g" || v === "ambos";

export type ConfigEscopo = {
  solucao?: SolucaoEscopo | string | null;
  /** Conexão única (versões antigas): vale para posto e comboio quando não há a específica. */
  comunicacao?: ConexaoDados | null;
  /** Conexão de dados do posto / pista. */
  comunicacao_posto?: ConexaoDados | null;
  /** Conexão de dados do comboio. */
  comunicacao_comboio?: ConexaoDados | null;
  rfid?: { ativo: boolean; itens: ItemRfid[] };
  tx?: { ativo: boolean; itens: ItemTx[] };
  outros?: ItemOutroDispositivo[];
  /** Equipamentos vendidos / da proposta, informados no agendamento. */
  equipamentos?: ItemEquipamento[];
};

/** Normaliza (limites, inteiros ≥ 1, descarta linhas vazias) a config vinda da interface. */
export function normalizarConfig(c: ConfigEscopo | null | undefined): ConfigEscopo {
  const q = (v: unknown) => Math.max(1, Math.min(100000, Math.floor(Number(v) || 1)));
  const txt = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const out: ConfigEscopo = {};
  if (c?.solucao) out.solucao = c.solucao;
  if (c?.comunicacao) out.comunicacao = c.comunicacao;
  if (ehConexaoDados(c?.comunicacao_posto)) out.comunicacao_posto = c!.comunicacao_posto;
  if (ehConexaoDados(c?.comunicacao_comboio)) out.comunicacao_comboio = c!.comunicacao_comboio;
  if (c?.rfid?.ativo) {
    out.rfid = {
      ativo: true,
      itens: (c.rfid.itens ?? [])
        .filter((i) => txt(i.tecnologia) || Number(i.quantidade) > 0)
        .slice(0, 50)
        .map((i) => ({
          tecnologia: txt(i.tecnologia),
          quantidade: q(i.quantidade),
          info: txt(i.info, 500) || undefined,
        })),
    };
  }
  if (c?.tx?.ativo) {
    out.tx = {
      ativo: true,
      itens: (c.tx.itens ?? [])
        .filter((i) => txt(i.modelo))
        .slice(0, 50)
        .map((i) => ({ modelo: txt(i.modelo), quantidade: q(i.quantidade), info: txt(i.info, 500) || undefined })),
    };
  }
  const outros = (c?.outros ?? [])
    .filter((i) => txt(i.nome))
    .slice(0, 50)
    .map((i) => ({
      nome: txt(i.nome),
      modelo: txt(i.modelo) || undefined,
      quantidade: q(i.quantidade),
      info: txt(i.info, 500) || undefined,
    }));
  if (outros.length) out.outros = outros;
  const equipamentos = (c?.equipamentos ?? [])
    .filter((i) => txt(i.descricao))
    .slice(0, 200)
    .map((i) => ({
      codigo: txt(i.codigo, 100) || undefined,
      descricao: txt(i.descricao, 300),
      quantidade: q(i.quantidade),
    }));
  if (equipamentos.length) out.equipamentos = equipamentos;
  return out;
}

/** true quando a config tem algo além do vazio (para decidir se há escopo a salvar). */
export function configTemDados(c: ConfigEscopo | null | undefined): boolean {
  const n = normalizarConfig(c);
  return Object.keys(n).length > 0;
}

export function rotuloSolucao(s: string | null | undefined): string | null {
  if (!s) return null;
  return SOLUCOES_ESCOPO.find((x) => x.value === s)?.label ?? s;
}

/** Comboio com seus tanques e bicos (como a bomba tem bicos). */
/** `nome`: identificação opcional do comboio (ex.: "Frota 400"); vira o nome dele no documento quando o agente não a informa. */
export type ComboioArvore = { tanques: number; bicos: number; nome?: string; filhos?: FilhosArvore };

export type ArvoreEscopo = {
  postos: PostoArvore[];
  comboios: ComboioArvore[];
  /** Opcionais e independentes da pista: podem existir sozinhos ou combinados. */
  tanquesLubrificante: ItemEscopo[];
  sondas: ItemEscopo[];
  /** Itens simples dos tipos criados em Configurações › Tipos de item (chave do tipo → itens). Ausente em escopos antigos. */
  extras?: Record<string, ItemEscopo[]>;
  frota: { ativo: boolean; itens: FrotaItemArvore[] };
  config: ConfigEscopo;
};

export const arvoreVazia = (): ArvoreEscopo => ({
  postos: [],
  comboios: [],
  tanquesLubrificante: [],
  sondas: [],
  frota: { ativo: false, itens: [] },
  config: {},
});

/** Tipos do sistema: tudo que não está aqui, na raiz do escopo, é um item simples de tipo novo. */
const TIPOS_FIXOS = new Set(["posto", "ilha", "bomba", "bico", "comboio", "frota", "sonda", "tanque", "tanque_lubrificante"]);
export const ehTipoFixo = (tipo: string) => TIPOS_FIXOS.has(tipo);

export const LIMITES = {
  postos: 20,
  ilhas: 30,
  bombas: 30,
  bicos: 12,
  comboios: 50,
  comboioTanques: 20,
  comboioBicos: 12,
  /** tanques com lubrificante */
  tanques: 50,
  sondas: 50,
  /** itens de cada tipo novo (Prédio, Produto…) */
  extras: 50,
} as const;

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
  tanque_lubrificante: "Tanque lubrificante",
};

/** "Comboio 01 — Frota 400". Com o catálogo, o nome do tipo é o configurado (ex.: "Prédio 02"). */
export function rotuloEntidade(tipo: TipoQualquer, ordem: number, nome?: string | null, catalogo?: TipoCatalogo[] | null) {
  const nomeDoTipo = catalogo ? rotuloDoTipo(catalogo, tipo) : (ROTULO_TIPO as Record<string, string>)[tipo] ?? rotuloDoTipo(CATALOGO_PADRAO, tipo);
  const base = tipo === "frota" ? nomeDoTipo : `${nomeDoTipo} ${pad2(ordem)}`;
  const n = nome?.trim();
  return n ? `${base} — ${n}` : base;
}

export type EntidadeEscopo = {
  id: string;
  tipo: TipoQualquer;
  parent_id: string | null;
  ordem: number;
  rotulo: string;
  ativo?: boolean;
  /** Dados livres da entidade (ex.: nome/identificação de tanque e sonda). */
  dados?: { nome?: string } | null;
};

/** Reconstrói a árvore editável a partir das entidades ativas (lista plana). */
export function arvoreDeEntidades(
  entidades: EntidadeEscopo[],
  frotaItens: FrotaItemArvore[] = [],
  config: ConfigEscopo = {},
): ArvoreEscopo {
  const filhos = (parent: string | null, tipo: TipoQualquer) =>
    entidades
      .filter((e) => e.tipo === tipo && e.parent_id === parent)
      .sort((a, b) => a.ordem - b.ordem);
  // itens de tipos novos dentro de uma entidade (qualquer tipo que não é do sistema), agrupados por tipo
  const filhosNovos = (parentId: string): { filhos?: FilhosArvore } => {
    const por: FilhosArvore = {};
    for (const e of entidades.filter((x) => x.parent_id === parentId && !ehTipoFixo(x.tipo)).sort((a, b) => a.ordem - b.ordem)) {
      (por[e.tipo] ??= []).push(itemDe(e));
    }
    return Object.keys(por).length ? { filhos: por } : {};
  };
  const itemDe = (e: EntidadeEscopo): ItemEscopo => ({ ...(e.dados?.nome ? { nome: e.dados.nome } : {}), ...filhosNovos(e.id) });
  const postos = filhos(null, "posto").map((p) => ({
    ilhas: filhos(p.id, "ilha").map((i) => ({
      bombas: filhos(i.id, "bomba").map((b) => ({ bicos: filhos(b.id, "bico").length, ...filhosNovos(b.id) })),
      ...filhosNovos(i.id),
    })),
    ...filhosNovos(p.id),
  }));
  const itens = (tipo: TipoQualquer): ItemEscopo[] => filhos(null, tipo).map(itemDe);
  // itens dos tipos novos que ficam na raiz do escopo
  const extras: Record<string, ItemEscopo[]> = {};
  for (const tipo of new Set(entidades.filter((e) => e.parent_id === null && !ehTipoFixo(e.tipo)).map((e) => e.tipo))) {
    const lista = itens(tipo);
    if (lista.length) extras[tipo] = lista;
  }
  return {
    postos,
    comboios: filhos(null, "comboio").map((c) => ({
      tanques: filhos(c.id, "tanque").length,
      bicos: filhos(c.id, "bico").length,
      ...(c.dados?.nome ? { nome: c.dados.nome } : {}),
      ...filhosNovos(c.id),
    })),
    tanquesLubrificante: itens("tanque_lubrificante"),
    sondas: itens("sonda"),
    ...(Object.keys(extras).length ? { extras } : {}),
    frota: { ativo: entidades.some((e) => e.tipo === "frota"), itens: frotaItens },
    config,
  };
}

/** Profundidade máxima de tipos novos aninhados (Prédio › Andar › Sala › …). */
const PROFUNDIDADE_MAX = 8;

/** Itens de tipos novos: só chaves válidas, listas vazias somem (a árvore lida do banco também não as tem). */
function normalizarFilhos(filhos: FilhosArvore | undefined, nivel = 0): { filhos?: FilhosArvore } {
  const out: FilhosArvore = {};
  if (nivel < PROFUNDIDADE_MAX) {
    for (const [chave, lista] of Object.entries(filhos ?? {})) {
      if (!ehChaveValida(chave) || !Array.isArray(lista) || !lista.length) continue;
      out[chave] = lista.slice(0, LIMITES.extras).map((t) => normalizarItem(t, nivel + 1));
    }
  }
  return Object.keys(out).length ? { filhos: out } : {};
}

function normalizarItem(t: ItemEscopo | undefined, nivel: number): ItemEscopo {
  return { nome: t?.nome?.trim() || undefined, ...normalizarFilhos(t?.filhos, nivel) };
}

function normalizarExtras(extras: ArvoreEscopo["extras"]): { extras?: Record<string, ItemEscopo[]> } {
  const { filhos } = normalizarFilhos(extras);
  return filhos ? { extras: filhos } : {};
}

/** Normaliza (limites, inteiros ≥ 0) uma árvore vinda da interface. */
export function normalizarArvore(a: ArvoreEscopo): ArvoreEscopo {
  const n = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
  // Formatos antigos: `comboios` era um número e os tanques da raiz se chamavam `tanques`.
  const legado = a as unknown as { comboios?: unknown; tanques?: ItemEscopo[] };
  const comboiosBrutos: { tanques?: unknown; bicos?: unknown; nome?: unknown }[] = Array.isArray(legado.comboios)
    ? (legado.comboios as { tanques?: unknown; bicos?: unknown; nome?: unknown }[])
    : Array.from({ length: n(legado.comboios, LIMITES.comboios) }, () => ({}));
  const lub = a.tanquesLubrificante ?? legado.tanques ?? [];
  return {
    postos: (a.postos ?? []).slice(0, LIMITES.postos).map((p) => ({
      ilhas: (p.ilhas ?? []).slice(0, LIMITES.ilhas).map((i) => ({
        bombas: (i.bombas ?? []).slice(0, LIMITES.bombas).map((b) => ({
          bicos: n(b.bicos, LIMITES.bicos),
          ...normalizarFilhos(b.filhos, 1),
        })),
        ...normalizarFilhos(i.filhos, 1),
      })),
      ...normalizarFilhos(p.filhos, 1),
    })),
    comboios: comboiosBrutos.slice(0, LIMITES.comboios).map((c) => {
      const nome = typeof c?.nome === "string" ? c.nome.trim() : "";
      return {
        tanques: n(c?.tanques, LIMITES.comboioTanques),
        bicos: n(c?.bicos, LIMITES.comboioBicos),
        ...(nome ? { nome } : {}),
        ...normalizarFilhos((c as { filhos?: FilhosArvore })?.filhos, 1),
      };
    }),
    tanquesLubrificante: lub.slice(0, LIMITES.tanques).map((t) => normalizarItem(t, 1)),
    sondas: (a.sondas ?? []).slice(0, LIMITES.sondas).map((t) => normalizarItem(t, 1)),
    ...normalizarExtras(a.extras),
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
    config: normalizarConfig(a.config),
  };
}

/** Quantos itens há de cada tipo novo, em todos os níveis (raiz e dentro de outros itens). */
export function contarItensExtras(a: ArvoreEscopo): Record<string, number> {
  const acc: Record<string, number> = {};
  const filhos = (f: FilhosArvore | undefined) => {
    for (const [tipo, lista] of Object.entries(f ?? {})) {
      acc[tipo] = (acc[tipo] ?? 0) + lista.length;
      for (const it of lista) filhos(it.filhos);
    }
  };
  filhos(a.extras);
  for (const it of [...(a.tanquesLubrificante ?? []), ...(a.sondas ?? [])]) filhos(it.filhos);
  for (const c of a.comboios ?? []) filhos(c.filhos);
  for (const p of a.postos ?? []) {
    filhos(p.filhos);
    for (const i of p.ilhas ?? []) {
      filhos(i.filhos);
      for (const b of i.bombas ?? []) filhos(b.filhos);
    }
  }
  return acc;
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
  return {
    postos: a.postos.length,
    ilhas,
    bombas,
    bicos,
    comboios: a.comboios.length,
    tanquesComboio: a.comboios.reduce((t, c) => t + c.tanques, 0),
    bicosComboio: a.comboios.reduce((t, c) => t + c.bicos, 0),
    /** tanques com lubrificante */
    tanques: (a.tanquesLubrificante ?? []).length,
    sondas: (a.sondas ?? []).length,
    /** quantidade de itens de cada tipo novo */
    extras: contarItensExtras(a),
    frota: a.frota.ativo,
  };
}

/** Item "desejado" (nível plano) gerado a partir da árvore, com caminho por índices. */
export type EntidadeDesejada = {
  chave: string; // ex.: "posto:1/ilha:2/bomba:1"
  tipo: TipoQualquer;
  paiChave: string | null;
  ordem: number;
  rotulo: string;
  nome?: string;
};

/**
 * Achata a árvore em entidades desejadas (ordem de criação: pais antes dos filhos).
 * Com o catálogo, os rótulos usam os nomes configurados (ex.: "Prédio 01").
 */
export function entidadesDesejadas(a: ArvoreEscopo, catalogo?: TipoCatalogo[] | null): EntidadeDesejada[] {
  const out: EntidadeDesejada[] = [];
  const add = (tipo: TipoQualquer, paiChave: string | null, ordem: number, nome?: string) => {
    const chave = `${paiChave ? paiChave + "/" : ""}${tipo}:${ordem}`;
    out.push({ chave, tipo, paiChave, ordem, rotulo: rotuloEntidade(tipo, ordem, nome, catalogo), nome: nome?.trim() || undefined });
    return chave;
  };
  // itens de tipos novos dentro de um pai (recursivo: pai antes do filho)
  const addFilhos = (paiChave: string | null, filhos: FilhosArvore | undefined) => {
    for (const [tipo, lista] of Object.entries(filhos ?? {})) {
      lista.forEach((t, i) => addFilhos(add(tipo, paiChave, i + 1, t.nome), t.filhos));
    }
  };
  a.postos.forEach((p, pi) => {
    const ck = add("posto", null, pi + 1);
    addFilhos(ck, p.filhos);
    p.ilhas.forEach((il, ii) => {
      const ik = add("ilha", ck, ii + 1);
      addFilhos(ik, il.filhos);
      il.bombas.forEach((b, bi) => {
        const bk = add("bomba", ik, bi + 1);
        for (let k = 1; k <= b.bicos; k++) add("bico", bk, k);
        addFilhos(bk, b.filhos);
      });
    });
  });
  a.comboios.forEach((c, ci) => {
    const ck = add("comboio", null, ci + 1, c.nome);
    for (let t = 1; t <= c.tanques; t++) add("tanque", ck, t);
    for (let k = 1; k <= c.bicos; k++) add("bico", ck, k);
    addFilhos(ck, c.filhos);
  });
  (a.tanquesLubrificante ?? []).forEach((t, i) => addFilhos(add("tanque_lubrificante", null, i + 1, t.nome), t.filhos));
  (a.sondas ?? []).forEach((t, i) => addFilhos(add("sonda", null, i + 1, t.nome), t.filhos));
  addFilhos(null, a.extras);
  if (a.frota.ativo) add("frota", null, 1);
  return out;
}
