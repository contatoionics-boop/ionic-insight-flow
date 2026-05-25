export type CaseStatus =
  | "rascunho"
  | "enviado"
  | "em_analise"
  | "aguardando_revisao"
  | "aprovado";

export const statusLabels: Record<CaseStatus, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  em_analise: "Em análise",
  aguardando_revisao: "Aguardando revisão",
  aprovado: "Aprovado",
};

export const statusTones: Record<CaseStatus, string> = {
  rascunho: "bg-muted text-muted-foreground",
  enviado: "bg-accent text-accent-foreground",
  em_analise: "bg-warning/20 text-warning-foreground",
  aguardando_revisao: "bg-primary/15 text-primary",
  aprovado: "bg-success/15 text-success",
};
