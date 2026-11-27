// Opções do agendamento editáveis em Configurações › Opções do agendamento: tipo de solicitação, modalidade,
// nível do mapeamento e solução. Código puro (client-safe).
//
// O valor gravado nos mapeamentos nunca muda (é a chave); o nome exibido, a visibilidade e a ordem vêm da tabela
// `opcoes_agendamento`. Sem a tabela (migration pendente) valem os padrões abaixo.
//
// `registro` é a cópia em memória usada por funções de rótulo que não recebem a lista (resumos, documento, agente).
// A tela carrega do banco via hook, e os pontos do servidor chamam `definirOpcoes` ao montar documento/checklist.

export type CampoOpcao = "tipo_solicitacao" | "modalidade" | "nivel" | "solucao";

export const CAMPOS_OPCAO: { campo: CampoOpcao; titulo: string; descricao: string }[] = [
  { campo: "tipo_solicitacao", titulo: "Tipo de solicitação", descricao: "Aparece ao agendar um mapeamento e no resumo do atendimento." },
  { campo: "modalidade", titulo: "Modalidade", descricao: "Como o mapeamento é feito (presencial, remoto…)." },
  { campo: "nivel", titulo: "Nível do mapeamento", descricao: "Nível de serviço contratado. Pode ser usado como condição nos textos padrão." },
  { campo: "solucao", titulo: "Solução", descricao: "Solução contratada, escolhida na estrutura do escopo. Pode ser usada como condição nos textos padrão." },
];

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

const CAMPOS = new Set<string>(CAMPOS_OPCAO.map((c) => c.campo));
const texto = (v: unknown, max = 80) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Junta os padrões com as linhas do banco (nome, visibilidade e ordem). Opção nova precisa de campo e valor válidos. */
export function mesclarOpcoes(linhas?: Partial<OpcaoAgendamento>[] | null): OpcaoAgendamento[] {
  const mapa = new Map<string, OpcaoAgendamento>(OPCOES_PADRAO.map((x) => [`${x.campo}|${x.valor}`, { ...x }]));
  for (const l of linhas ?? []) {
    const campo = texto(l?.campo, 30);
    const valor = texto(l?.valor, 40);
    if (!CAMPOS.has(campo) || !SLUG_OPCAO.test(valor)) continue;
    const chave = `${campo}|${valor}`;
    const base = mapa.get(chave);
    const ordem = Number.isFinite(l.ordem) ? Number(l.ordem) : (base?.ordem ?? 100);
    if (base) mapa.set(chave, { ...base, rotulo: texto(l.rotulo) || base.rotulo, ativo: l.ativo !== false, ordem });
    else if (texto(l.rotulo)) mapa.set(chave, { campo: campo as CampoOpcao, valor, rotulo: texto(l.rotulo), ativo: l.ativo !== false, ordem, sistema: false });
  }
  return [...mapa.values()].sort((a, b) => a.ordem - b.ordem || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

let registro: OpcaoAgendamento[] = mesclarOpcoes();

/** Atualiza a cópia em memória (tela e servidor). */
export function definirOpcoes(linhas?: Partial<OpcaoAgendamento>[] | null): OpcaoAgendamento[] {
  registro = mesclarOpcoes(linhas);
  return registro;
}

export const opcoesAtuais = (): OpcaoAgendamento[] => registro;

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
