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
  /** Tanque do comboio (filho do comboio, como o bico é filho da bomba). */
  | "tanque"
  /** Tanque com lubrificante (raiz, independente da pista; tem formulário próprio). */
  | "tanque_lubrificante";

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
export function tipoEntidadeDaAplicacao(a: string | null | undefined): TipoEntidade | null {
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
      return null;
  }
}

export type BombaArvore = { bicos: number };
export type IlhaArvore = { bombas: BombaArvore[] };
export type PostoArvore = { ilhas: IlhaArvore[] };
export type FrotaItemArvore = { modelo: string; quantidade: number; info?: string };

/** Item de uma coleção independente (tanques, sondas). `nome` é a identificação opcional. */
export type ItemEscopo = { nome?: string };

/** Solução contratada escolhida no agendamento. */
export type SolucaoEscopo = "ssg_frota" | "on_premise";
export const SOLUCOES_ESCOPO: { value: SolucaoEscopo; label: string }[] = [
  { value: "ssg_frota", label: "SSG Frota" },
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
export type ChaveSugestao = (typeof SUGERIR_QUANDO_OPCOES)[number]["value"];

/** Quantidade de cada item do escopo (base para sugerir formulários e quantidades). */
export function quantidadesDoEscopo(a: ArvoreEscopo): Record<ChaveSugestao, number> {
  return {
    pista: a.postos.length,
    comboio: a.comboios.length,
    tanque_lubrificante: (a.tanquesLubrificante ?? []).length,
    sonda: (a.sondas ?? []).length,
    frota: a.frota?.ativo ? 1 : 0,
  };
}

/** Tecnologias de cartão RFID oferecidas na lista (além de "Outra", texto livre). */
export const TECNOLOGIAS_RFID = ["Mifare", "Milexes"] as const;

export type ItemRfid = { tecnologia: string; quantidade: number; info?: string };
export type ItemTx = { modelo: string; quantidade: number; info?: string };
export type ItemOutroDispositivo = { nome: string; modelo?: string; quantidade: number; info?: string };
/** Equipamento vendido (proposta comercial): vira a tabela "Produtos IONICS" do documento. */
export type ItemEquipamento = { codigo?: string; descricao: string; quantidade: number };

/**
 * Configuração da versão do Escopo. Dados de escopo (não geram perguntas por item):
 * solução, RFID, TX e outros dispositivos adicionados quando necessário.
 */
export type ConfigEscopo = {
  solucao?: SolucaoEscopo | string | null;
  comunicacao?: "wifi" | "4g" | "ambos" | null;
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
  if (c?.rfid?.ativo) {
    out.rfid = {
      ativo: true,
      itens: (c.rfid.itens ?? [])
        .filter((i) => txt(i.tecnologia))
        .slice(0, 50)
        .map((i) => ({ tecnologia: txt(i.tecnologia), quantidade: q(i.quantidade), info: txt(i.info, 500) || undefined })),
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
export type ComboioArvore = { tanques: number; bicos: number };

export type ArvoreEscopo = {
  postos: PostoArvore[];
  comboios: ComboioArvore[];
  /** Opcionais e independentes da pista: podem existir sozinhos ou combinados. */
  tanquesLubrificante: ItemEscopo[];
  sondas: ItemEscopo[];
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

export function rotuloEntidade(tipo: TipoEntidade, ordem: number, nome?: string | null) {
  const base = tipo === "frota" ? ROTULO_TIPO.frota : `${ROTULO_TIPO[tipo]} ${pad2(ordem)}`;
  const n = nome?.trim();
  return n ? `${base} — ${n}` : base;
}

export type EntidadeEscopo = {
  id: string;
  tipo: TipoEntidade;
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
  const filhos = (parent: string | null, tipo: TipoEntidade) =>
    entidades
      .filter((e) => e.tipo === tipo && e.parent_id === parent)
      .sort((a, b) => a.ordem - b.ordem);
  const postos = filhos(null, "posto").map((p) => ({
    ilhas: filhos(p.id, "ilha").map((i) => ({
      bombas: filhos(i.id, "bomba").map((b) => ({ bicos: filhos(b.id, "bico").length })),
    })),
  }));
  const itens = (tipo: TipoEntidade): ItemEscopo[] =>
    filhos(null, tipo).map((e) => (e.dados?.nome ? { nome: e.dados.nome } : {}));
  return {
    postos,
    comboios: filhos(null, "comboio").map((c) => ({
      tanques: filhos(c.id, "tanque").length,
      bicos: filhos(c.id, "bico").length,
    })),
    tanquesLubrificante: itens("tanque_lubrificante"),
    sondas: itens("sonda"),
    frota: { ativo: entidades.some((e) => e.tipo === "frota"), itens: frotaItens },
    config,
  };
}

/** Normaliza (limites, inteiros ≥ 0) uma árvore vinda da interface. */
export function normalizarArvore(a: ArvoreEscopo): ArvoreEscopo {
  const n = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
  // Formatos antigos: `comboios` era um número e os tanques da raiz se chamavam `tanques`.
  const legado = a as unknown as { comboios?: unknown; tanques?: ItemEscopo[] };
  const comboiosBrutos: { tanques?: unknown; bicos?: unknown }[] = Array.isArray(legado.comboios)
    ? (legado.comboios as { tanques?: unknown; bicos?: unknown }[])
    : Array.from({ length: n(legado.comboios, LIMITES.comboios) }, () => ({}));
  const lub = a.tanquesLubrificante ?? legado.tanques ?? [];
  return {
    postos: (a.postos ?? []).slice(0, LIMITES.postos).map((p) => ({
      ilhas: (p.ilhas ?? []).slice(0, LIMITES.ilhas).map((i) => ({
        bombas: (i.bombas ?? []).slice(0, LIMITES.bombas).map((b) => ({
          bicos: n(b.bicos, LIMITES.bicos),
        })),
      })),
    })),
    comboios: comboiosBrutos.slice(0, LIMITES.comboios).map((c) => ({
      tanques: n(c?.tanques, LIMITES.comboioTanques),
      bicos: n(c?.bicos, LIMITES.comboioBicos),
    })),
    tanquesLubrificante: lub.slice(0, LIMITES.tanques).map((t) => ({ nome: t.nome?.trim() || undefined })),
    sondas: (a.sondas ?? []).slice(0, LIMITES.sondas).map((t) => ({ nome: t.nome?.trim() || undefined })),
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
    frota: a.frota.ativo,
  };
}

/** Item "desejado" (nível plano) gerado a partir da árvore, com caminho por índices. */
export type EntidadeDesejada = {
  chave: string; // ex.: "posto:1/ilha:2/bomba:1"
  tipo: TipoEntidade;
  paiChave: string | null;
  ordem: number;
  rotulo: string;
  nome?: string;
};

/** Achata a árvore em entidades desejadas (ordem de criação: pais antes dos filhos). */
export function entidadesDesejadas(a: ArvoreEscopo): EntidadeDesejada[] {
  const out: EntidadeDesejada[] = [];
  const add = (tipo: TipoEntidade, paiChave: string | null, ordem: number, nome?: string) => {
    const chave = `${paiChave ? paiChave + "/" : ""}${tipo}:${ordem}`;
    out.push({ chave, tipo, paiChave, ordem, rotulo: rotuloEntidade(tipo, ordem, nome), nome: nome?.trim() || undefined });
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
  a.comboios.forEach((c, ci) => {
    const ck = add("comboio", null, ci + 1);
    for (let t = 1; t <= c.tanques; t++) add("tanque", ck, t);
    for (let k = 1; k <= c.bicos; k++) add("bico", ck, k);
  });
  (a.tanquesLubrificante ?? []).forEach((t, i) => add("tanque_lubrificante", null, i + 1, t.nome));
  (a.sondas ?? []).forEach((t, i) => add("sonda", null, i + 1, t.nome));
  if (a.frota.ativo) add("frota", null, 1);
  return out;
}
