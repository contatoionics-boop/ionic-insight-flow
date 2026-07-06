import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarPlus, CheckCircle2, XCircle, Repeat, Ban, Play, Send,
  ThumbsUp, ThumbsDown, Flag, MessageSquare, UserPlus, ClipboardCheck,
} from "lucide-react";
import { Card } from "@/components/ui-bits";
import { listarEventosDoMapeamento, type EventoRow } from "@/lib/eventos.functions";
import { roleLabels, type Role } from "@/lib/auth";

const LABELS: Record<EventoRow["tipo"], string> = {
  mapeamento_criado: "Mapeamento criado",
  agendamento_criado: "Agendamento criado",
  agente_atribuido: "Agente atribuído",
  aceite_confirmado: "Aceite confirmado pelo agente",
  aceite_recusado: "Agendamento recusado pelo agente",
  reagendado: "Reagendado",
  agendamento_cancelado: "Agendamento cancelado",
  vistoria_iniciada: "Vistoria iniciada em campo",
  vistoria_finalizada: "Vistoria entregue para revisão",
  revisao_aprovada: "Aprovado na revisão",
  revisao_reprovada: "Reprovado na revisão",
  mapeamento_concluido: "Mapeamento concluído",
  observacao_adicionada: "Observação adicionada",
};

const ICONS: Record<EventoRow["tipo"], any> = {
  mapeamento_criado: ClipboardCheck,
  agendamento_criado: CalendarPlus,
  agente_atribuido: UserPlus,
  aceite_confirmado: CheckCircle2,
  aceite_recusado: XCircle,
  reagendado: Repeat,
  agendamento_cancelado: Ban,
  vistoria_iniciada: Play,
  vistoria_finalizada: Send,
  revisao_aprovada: ThumbsUp,
  revisao_reprovada: ThumbsDown,
  mapeamento_concluido: Flag,
  observacao_adicionada: MessageSquare,
};

const CORES: Record<EventoRow["tipo"], string> = {
  mapeamento_criado: "bg-muted text-muted-foreground",
  agendamento_criado: "bg-primary/15 text-primary",
  agente_atribuido: "bg-primary/15 text-primary",
  aceite_confirmado: "bg-success/15 text-success",
  aceite_recusado: "bg-destructive/15 text-destructive",
  reagendado: "bg-warning/15 text-warning-foreground",
  agendamento_cancelado: "bg-destructive/15 text-destructive",
  vistoria_iniciada: "bg-accent text-accent-foreground",
  vistoria_finalizada: "bg-primary/15 text-primary",
  revisao_aprovada: "bg-success/15 text-success",
  revisao_reprovada: "bg-destructive/15 text-destructive",
  mapeamento_concluido: "bg-success/15 text-success",
  observacao_adicionada: "bg-muted text-muted-foreground",
};

function fmtData(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDataCurta(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function papelLabel(p: EventoRow["ator_papel"]): string {
  if (p === "sistema") return "Sistema";
  return roleLabels[p as Role] ?? p;
}

function renderMetadata(e: EventoRow): string | null {
  const m = e.metadata ?? {};
  if (e.tipo === "aceite_recusado" && m.motivo) return `Motivo: ${m.motivo}`;
  if (e.tipo === "revisao_reprovada" && m.motivo) return `Motivo: ${m.motivo}`;
  if (e.tipo === "reagendado") {
    const antes = fmtDataCurta(m.agendado_em_anterior as string | null);
    const depois = fmtDataCurta(m.agendado_em_novo as string | null);
    const troca = m.agente_anterior_nome && m.agente_novo_nome && m.agente_anterior_id !== m.agente_novo_id
      ? ` · Agente: ${m.agente_anterior_nome} → ${m.agente_novo_nome}`
      : "";
    return `De ${antes} para ${depois}${troca}`;
  }
  if (e.tipo === "agendamento_criado") {
    const quando = fmtDataCurta(m.agendado_em as string | null);
    const agente = (m.agente_nome as string) ?? null;
    return agente ? `Para ${quando} · Agente: ${agente}` : `Para ${quando}`;
  }
  if (e.tipo === "observacao_adicionada" && m.texto) return String(m.texto);
  return null;
}

export function HistoricoEventos({ casoId }: { casoId: string }) {
  const listar = useServerFn(listarEventosDoMapeamento);
  const [rows, setRows] = useState<EventoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    listar({ data: { casoId } })
      .then((data) => {
        if (!alive) return;
        setRows(data);
      })
      .catch((e) => alive && setErro(e?.message ?? "Erro ao carregar histórico"))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [casoId, listar]);

  return (
    <Card>
      <h3 className="mb-4 text-sm font-semibold text-foreground">Histórico completo</h3>
      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : erro ? (
        <p className="text-sm text-destructive">{erro}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
      ) : (
        <ol className="relative space-y-4 border-l border-border pl-6">
          {rows.map((e) => {
            const Icon = ICONS[e.tipo] ?? MessageSquare;
            const cor = CORES[e.tipo] ?? "bg-muted text-muted-foreground";
            const detalhe = renderMetadata(e);
            return (
              <li key={e.id} className="relative">
                <span className={`absolute -left-[34px] flex h-6 w-6 items-center justify-center rounded-full ${cor}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <p className="text-sm font-medium text-foreground">{LABELS[e.tipo] ?? e.tipo}</p>
                <p className="text-xs text-muted-foreground">
                  {fmtData(e.ocorrido_em)}
                  {e.ator_nome ? ` · por ${e.ator_nome}` : ""}
                  {` · ${papelLabel(e.ator_papel)}`}
                </p>
                {detalhe && (
                  <p className="mt-1 text-xs text-foreground whitespace-pre-wrap">{detalhe}</p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
