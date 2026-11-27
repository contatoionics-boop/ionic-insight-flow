export type CaseStatus =
  | "rascunho"
  | "agendado"
  | "em_andamento"
  | "enviado"
  | "em_analise"
  | "aguardando_revisao"
  | "aprovado"
  | "concluido"
  | "cancelado";

export const statusLabels: Record<CaseStatus, string> = {
  rascunho: "Rascunho",
  agendado: "Agendado",
  em_andamento: "Em andamento",
  enviado: "Enviado",
  em_analise: "Em análise",
  aguardando_revisao: "Aguardando revisão",
  aprovado: "Aprovado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export const statusTones: Record<CaseStatus, string> = {
  rascunho: "bg-muted text-muted-foreground",
  agendado: "bg-accent text-accent-foreground",
  em_andamento: "bg-warning/20 text-warning-foreground",
  enviado: "bg-accent text-accent-foreground",
  em_analise: "bg-warning/20 text-warning-foreground",
  aguardando_revisao: "bg-primary/15 text-primary",
  aprovado: "bg-success/15 text-success",
  concluido: "bg-success/15 text-success",
  cancelado: "bg-destructive/15 text-destructive",
};

import { rotuloOpcao } from "@/lib/opcoes-agendamento";

// Os valores vêm de Configurações › Opções do agendamento (podem ser criados lá): são só texto.
export type TipoSolicitacao = string;
export type ModalidadeAtendimento = string;
export type NivelMapeamento = string;

/** Nomes padrão (valem quando a tabela de opções não está disponível). Os nomes configurados vêm de `rotuloOpcao`. */
export const tipoSolicitacaoLabels: Record<string, string> = {
  instalacao: "Instalação",
  upgrade: "Upgrade",
};

export const modalidadeLabels: Record<string, string> = {
  presencial: "Presencial",
  remoto: "Remoto",
};

export const nivelLabels: Record<string, string> = {
  nivel_1: "Nível 1",
  nivel_2: "Nível 2",
  nivel_3: "Nível 3",
};

export function resumoAtendimento(opts: {
  tipo_solicitacao?: string | null;
  modalidade?: string | null;
  nivel?: string | null;
}) {
  return [
    rotuloOpcao("tipo_solicitacao", opts.tipo_solicitacao),
    rotuloOpcao("modalidade", opts.modalidade),
    rotuloOpcao("nivel", opts.nivel),
  ]
    .filter(Boolean)
    .join(" · ");
}
