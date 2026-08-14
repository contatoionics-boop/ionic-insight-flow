/**
 * Fonte ÚNICA dos metadados de cabeçalho do FR-31-10.
 * Puro (client/server-safe): usado pelo renderer do PDF e pela folha WYSIWYG.
 */
import type { VariaveisLaudo } from "@/lib/laudo/tipos";

/** Regra de negócio: o especialista em automação é sempre PABLO. */
export const ESPECIALISTA_AUTOMACAO_PADRAO = "PABLO";
export const TITULO_DOCUMENTO = "Resultado de Mapeamento Técnico";
export const CODIGO_DOCUMENTO = "FR-31-10";

export type EntradaMetaLaudo = {
  caso: {
    codigo?: string | null;
    agendado_em?: string | null;
    data_execucao?: string | null;
    agente_nome_manual?: string | null;
    /** perfil do agente ATRIBUÍDO ao mapeamento (casos.agente_id) */
    agente?: { nome?: string | null; email?: string | null } | null;
    unidade?: {
      nome?: string | null;
      codigo_ionics?: string | null;
      matriz?: {
        nome?: string | null;
        empresa?: { nome?: string | null; codigo_ionics?: string | null } | null;
      } | null;
    } | null;
  };
  variaveis: VariaveisLaudo;
  /** nome do usuário que CRIOU o agendamento (agendamentos.criado_por -> profiles.nome) */
  criadorAgendamento?: string | null;
  /** nome do perfil correspondente ao especialista em automação, quando existir */
  especialistaPerfil?: string | null;
  formulario?: { nome?: string | null; codigo?: string | null; revisao?: string | null } | null;
};

export type MetaLaudo = {
  cliente: string;
  unidade: string;
  empresaNome: string;
  data: string;
  agente: string;
  analista: string;
  especialista: string;
  codigoDocumento: string;
  codigoFormulario: string | null;
  revisao: string | null;
  filename: string;
  nomeDocumento: string;
};

function vazio(v: string | null | undefined): boolean {
  const s = (v ?? "").trim();
  return !s || s === "—" || s === "-";
}

/** resposta explícita do formulário / confirmação manual do especialista */
function explicito(vars: VariaveisLaudo, chave: string): string | null {
  const item = vars?.[chave];
  const v = (item?.valor ?? "").trim();
  if (!v) return null;
  return item?.origem === "formulario" || item?.origem === "manual" ? v : null;
}

function qualquer(vars: VariaveisLaudo, chave: string): string | null {
  const v = (vars?.[chave]?.valor ?? "").trim();
  return v || null;
}

function dataBR(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("pt-BR");
}

/** `FR-29-10` a partir do código cadastrado ou do próprio nome do formulário. */
export function codigoDoFormulario(
  formulario?: { nome?: string | null; codigo?: string | null } | null,
): string | null {
  const cod = (formulario?.codigo ?? "").trim();
  if (cod) return cod;
  const nome = (formulario?.nome ?? "").trim();
  const m = nome.match(/\bFR[-\s]?\d+[-\s]?\d+\b/i);
  if (m) return m[0].toUpperCase().replace(/\s/g, "-");
  return nome ? nome.slice(0, 40) : null;
}

/** remove caracteres inválidos de filename preservando acentos */
export function sanitizarNomeArquivo(s: string): string {
  return (s || "")
    .replace(/[/\\:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

export function nomeArquivoLaudo(codigoFormulario: string | null, empresa: string): string {
  const partes = [codigoFormulario, TITULO_DOCUMENTO, empresa]
    .map((p) => sanitizarNomeArquivo(p ?? ""))
    .filter(Boolean);
  return `${partes.join(" - ") || "Resultado de Mapeamento Técnico"}.pdf`;
}

export function resolverMetaLaudo(entrada: EntradaMetaLaudo): MetaLaudo {
  const { caso, variaveis: vars } = entrada;
  const u = caso?.unidade;
  const empresa = u?.matriz?.empresa?.nome ?? u?.matriz?.nome ?? "—";
  const codigoUnidade = u?.codigo_ionics ?? u?.matriz?.empresa?.codigo_ionics ?? null;

  const clienteCadastro = codigoUnidade ? `${empresa} (${codigoUnidade})` : empresa;
  const cliente = explicito(vars, "nome_cliente") ?? (!vazio(clienteCadastro) ? clienteCadastro : qualquer(vars, "nome_cliente")) ?? "—";
  const unidade = explicito(vars, "unidade") ?? (!vazio(u?.nome) ? (u!.nome as string) : qualquer(vars, "unidade")) ?? "—";

  // data efetiva (execução) > resposta explícita do formulário > agendada
  const data =
    dataBR(caso?.data_execucao) ??
    explicito(vars, "data_mapeamento") ??
    dataBR(caso?.agendado_em) ??
    qualquer(vars, "data_mapeamento") ??
    "—";

  // agente = para quem o mapeamento foi atribuído
  const agente =
    (caso?.agente?.nome || caso?.agente?.email || caso?.agente_nome_manual || "").trim() ||
    explicito(vars, "agente_tecnico") ||
    qualquer(vars, "agente_tecnico") ||
    "—";

  // analista = responsável interno (quem criou o agendamento/processo);
  // edição manual do especialista continua vencendo
  const analista =
    (vars?.["analista_projetos"]?.origem === "manual"
      ? (vars["analista_projetos"]?.valor ?? "").trim()
      : "") ||
    (entrada.criadorAgendamento ?? "").trim() ||
    qualquer(vars, "analista_projetos") ||
    "—";

  const especialista =
    (vars?.["especialista_automacao"]?.origem === "manual"
      ? (vars["especialista_automacao"]?.valor ?? "").trim()
      : "") ||
    (entrada.especialistaPerfil ?? "").trim() ||
    ESPECIALISTA_AUTOMACAO_PADRAO;

  const codigoFormulario = codigoDoFormulario(entrada.formulario);

  return {
    cliente,
    unidade,
    empresaNome: empresa,
    data,
    agente,
    analista,
    especialista,
    codigoDocumento: CODIGO_DOCUMENTO,
    codigoFormulario,
    revisao: entrada.formulario?.revisao ?? null,
    nomeDocumento: `${codigoFormulario ? `${codigoFormulario} - ` : ""}${TITULO_DOCUMENTO} - ${empresa}`,
    filename: nomeArquivoLaudo(codigoFormulario, empresa),
  };
}
