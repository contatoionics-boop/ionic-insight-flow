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
