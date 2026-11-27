// Opções do agendamento editáveis em Configurações › Opções do agendamento: tipo de solicitação, modalidade,
// nível do mapeamento e solução. Código puro (client-safe).
//
// O valor gravado nos mapeamentos nunca muda (é a chave); o nome exibido, a visibilidade e a ordem vêm da tabela
// `opcoes_agendamento`. Sem a tabela (migration pendente) valem os padrões abaixo.
//
// `registro` é a cópia em memória usada por funções de rótulo que não recebem a lista (resumos, documento, agente).
// A tela carrega do banco via hook, e os pontos do servidor chamam `definirOpcoes` ao montar documento/checklist.

/** Chave do campo: um dos quatro fixos ou a de um campo criado em Configurações › Opções do agendamento. */
export type CampoOpcao = "tipo_solicitacao" | "modalidade" | "nivel" | "solucao" | (string & {});

/** Os quatro campos fixos (têm lugar próprio no sistema); os criados pelo gestor vêm de `campos_agendamento`. */
export type CampoAgendamento = {
  campo: CampoOpcao;
  titulo: string;
  descricao: string;
  /** campo criado pelo gestor: precisa ser escolhido ao agendar? (os fixos têm sempre valor) */
  obrigatorio: boolean;
  ativo: boolean;
  ordem: number;
  /** vem com o sistema (os quatro fixos): não se renomeia nem se oculta */
  sistema: boolean;
};

export const CAMPOS_OPCAO: CampoAgendamento[] = [
  { campo: "tipo_solicitacao", titulo: "Tipo de solicitação", descricao: "Aparece ao agendar um mapeamento e no resumo do atendimento.", obrigatorio: true, ativo: true, ordem: 1, sistema: true },
  { campo: "modalidade", titulo: "Modalidade", descricao: "Como o mapeamento é feito (presencial, remoto…).", obrigatorio: true, ativo: true, ordem: 2, sistema: true },
  { campo: "nivel", titulo: "Nível do mapeamento", descricao: "Nível de serviço contratado. Pode ser usado como condição nos textos padrão.", obrigatorio: true, ativo: true, ordem: 3, sistema: true },
  { campo: "solucao", titulo: "Solução", descricao: "Solução contratada, escolhida na estrutura do escopo. Pode ser usada como condição nos textos padrão.", obrigatorio: false, ativo: true, ordem: 4, sistema: true },
];

export const CHAVES_CAMPOS_FIXOS: string[] = CAMPOS_OPCAO.map((c) => c.campo);

/** Junta os quatro fixos com os campos criados pelo gestor (chave válida e que não colide com os fixos). */
export function mesclarCampos(linhas?: Partial<CampoAgendamento & { chave: string }>[] | null): CampoAgendamento[] {
  const extras: CampoAgendamento[] = [];
  for (const l of linhas ?? []) {
    const campo = texto(l?.chave ?? l?.campo, 40);
    const titulo = texto(l?.titulo, 80);
    if (!SLUG_CAMPO.test(campo) || CHAVES_CAMPOS_FIXOS.includes(campo) || !titulo || extras.some((x) => x.campo === campo)) continue;
    extras.push({
      campo,
      titulo,
      descricao: texto(l.descricao, 300),
      obrigatorio: l.obrigatorio === true,
      ativo: l.ativo !== false,
      ordem: Number.isFinite(l.ordem) ? Number(l.ordem) : 100,
      sistema: false,
    });
  }
  extras.sort((a, b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo, "pt-BR"));
  return [...CAMPOS_OPCAO.map((c) => ({ ...c })), ...extras];
}

export type OpcaoAgendamento = {
  campo: CampoOpcao;
  valor: string;
  rotulo: string;
  ativo: boolean;
  ordem: number;
  /** já vem com o sistema: o valor é fixo (só nome, ordem e visibilidade mudam) */
  sistema: boolean;
};

export const SLUG_OPCAO = /^[a-z][a-z0-9_]{0,39}$/;
export const SLUG_CAMPO = /^[a-z][a-z0-9_]{1,39}$/;

const o = (campo: CampoOpcao, valor: string, rotulo: string, ordem: number): OpcaoAgendamento => ({ campo, valor, rotulo, ativo: true, ordem, sistema: true });

export const OPCOES_PADRAO: OpcaoAgendamento[] = [
  o("tipo_solicitacao", "instalacao", "Instalação", 10),
  o("tipo_solicitacao", "upgrade", "Upgrade", 20),
  o("modalidade", "presencial", "Presencial", 10),
  o("modalidade", "remoto", "Remoto", 20),
  o("nivel", "nivel_1", "Nível 1", 10),
  o("nivel", "nivel_2", "Nível 2", 20),
  o("nivel", "nivel_3", "Nível 3", 30),
  o("solucao", "ssg_frota", "SSGFROTA", 10),
  o("solucao", "on_premise", "On-premise", 20),
];

const texto = (v: unknown, max = 80) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Junta os padrões com as linhas do banco (nome, visibilidade e ordem). Opção nova precisa de campo e valor válidos. */
export function mesclarOpcoes(linhas?: Partial<OpcaoAgendamento>[] | null): OpcaoAgendamento[] {
  const mapa = new Map<string, OpcaoAgendamento>(OPCOES_PADRAO.map((x) => [`${x.campo}|${x.valor}`, { ...x }]));
  for (const l of linhas ?? []) {
    const campo = texto(l?.campo, 30);
    const valor = texto(l?.valor, 40);
    if (!SLUG_CAMPO.test(campo) || !SLUG_OPCAO.test(valor)) continue;
    const chave = `${campo}|${valor}`;
    const base = mapa.get(chave);
    const ordem = Number.isFinite(l.ordem) ? Number(l.ordem) : (base?.ordem ?? 100);
    if (base) mapa.set(chave, { ...base, rotulo: texto(l.rotulo) || base.rotulo, ativo: l.ativo !== false, ordem });
    else if (texto(l.rotulo)) mapa.set(chave, { campo: campo as CampoOpcao, valor, rotulo: texto(l.rotulo), ativo: l.ativo !== false, ordem, sistema: false });
  }
  return [...mapa.values()].sort((a, b) => a.ordem - b.ordem || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

let registro: OpcaoAgendamento[] = mesclarOpcoes();
let registroCampos: CampoAgendamento[] = mesclarCampos();

/** Atualiza a cópia em memória (tela e servidor). */
export function definirOpcoes(linhas?: Partial<OpcaoAgendamento>[] | null): OpcaoAgendamento[] {
  registro = mesclarOpcoes(linhas);
  return registro;
}

export const opcoesAtuais = (): OpcaoAgendamento[] => registro;

/** Atualiza a cópia em memória dos campos (os fixos e os criados pelo gestor). */
export function definirCampos(linhas?: Partial<CampoAgendamento & { chave: string }>[] | null): CampoAgendamento[] {
  registroCampos = mesclarCampos(linhas);
  return registroCampos;
}

export const camposAtuais = (): CampoAgendamento[] => registroCampos;

/** Campos criados pelo gestor e ativos, na ordem (os que aparecem como lista extra ao agendar). */
export const camposExtrasAtivos = (campos: CampoAgendamento[] = registroCampos): CampoAgendamento[] => campos.filter((c) => !c.sistema && c.ativo);

/**
 * Escolhas dos campos criados pelo gestor, em texto: ["Tipo de mapeamento: Completo"]. Só entra o que tem valor;
 * campo apagado/desconhecido não aparece.
 */
export function resumoCamposExtras(extras: Record<string, unknown> | null | undefined, campos: CampoAgendamento[] = registroCampos, todas: OpcaoAgendamento[] = registro): string[] {
  const out: string[] = [];
  for (const c of campos.filter((x) => !x.sistema)) {
    const v = extras?.[c.campo];
    if (typeof v !== "string" || !v) continue;
    out.push(rotuloOpcao(c.campo, v, todas) ?? v);
  }
  return out;
}

/** Opções ativas de um campo, na ordem. `incluir`: valores já gravados que devem continuar aparecendo mesmo ocultos. */
export function opcoesDoCampo(campo: CampoOpcao, opts: { todas?: OpcaoAgendamento[]; incluir?: (string | null | undefined)[] } = {}): OpcaoAgendamento[] {
  const incluir = new Set((opts.incluir ?? []).filter(Boolean) as string[]);
  return (opts.todas ?? registro).filter((x) => x.campo === campo && (x.ativo || incluir.has(x.valor)));
}

/** Nome exibido do valor; null quando o valor é vazio. Valor desconhecido mostra o próprio valor. */
export function rotuloOpcao(campo: CampoOpcao, valor: string | null | undefined, todas: OpcaoAgendamento[] = registro): string | null {
  if (!valor) return null;
  return todas.find((x) => x.campo === campo && x.valor === valor)?.rotulo ?? valor;
}

/** Rótulo de qualquer valor das opções (os valores de campos diferentes não se repetem). */
export function rotuloDeQualquerOpcao(valor: string | null | undefined, todas: OpcaoAgendamento[] = registro): string | null {
  if (!valor) return null;
  return todas.find((x) => x.valor === valor)?.rotulo ?? null;
}

/** Chave de um campo novo a partir do título ("Tipo de mapeamento" → "tipo_de_mapeamento"), sem repetir as já usadas. */
export function chaveDoCampo(titulo: string, usadas: Iterable<string>): string {
  const ocupadas = new Set([...usadas, ...CHAVES_CAMPOS_FIXOS]);
  return valorDoNome(titulo, ocupadas).replace(/^(.{1})$/, "$1_campo").slice(0, 39);
}

/** Valor a partir do nome ("Nível 4" → "nivel_4"), sem repetir os já usados no campo. */
export function valorDoNome(nome: string, usados: Iterable<string>): string {
  const base =
    nome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/^[0-9_]+/, "")
      .slice(0, 30) || "opcao";
  const ocupados = new Set(usados);
  if (!ocupados.has(base)) return base;
  for (let i = 2; i < 1000; i++) if (!ocupados.has(`${base}_${i}`)) return `${base}_${i}`;
  return `${base}_${Date.now().toString(36)}`.slice(0, 40);
}
