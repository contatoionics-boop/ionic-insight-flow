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

export type TipoSolicitacao = "instalacao" | "upgrade";
export type ModalidadeAtendimento = "presencial" | "remoto";
export type NivelMapeamento = "nivel_1" | "nivel_2" | "nivel_3";

export const tipoSolicitacaoLabels: Record<TipoSolicitacao, string> = {
  instalacao: "Instalação",
  upgrade: "Upgrade",
};

export const modalidadeLabels: Record<ModalidadeAtendimento, string> = {
  presencial: "Presencial",
  remoto: "Remoto",
};

export const nivelLabels: Record<NivelMapeamento, string> = {
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
    opts.tipo_solicitacao ? tipoSolicitacaoLabels[opts.tipo_solicitacao as TipoSolicitacao] : null,
    opts.modalidade ? modalidadeLabels[opts.modalidade as ModalidadeAtendimento] : null,
    opts.nivel ? nivelLabels[opts.nivel as NivelMapeamento] : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
