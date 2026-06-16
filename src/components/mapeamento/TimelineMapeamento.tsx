import { CalendarDays, Play, Send, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui-bits";

type Etapa = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  data: string | null;
};

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TimelineMapeamento({
  agendado,
  execucao,
  entrega,
  aprovacao,
}: {
  agendado: string | null;
  execucao: string | null;
  entrega: string | null;
  aprovacao: string | null;
}) {
  const etapas: Etapa[] = [
    { label: "Agendado", icon: CalendarDays, data: agendado },
    { label: "Execução em campo", icon: Play, data: execucao },
    { label: "Entrega do agente", icon: Send, data: entrega },
    { label: "Aprovação final", icon: CheckCircle2, data: aprovacao },
  ];

  const agora = Date.now();
  const atraso = (idx: number) => {
    const atual = etapas[idx].data;
    const proxima = etapas[idx + 1]?.data ?? null;
    if (!atual || proxima || idx === etapas.length - 1) return false;
    return agora - new Date(atual).getTime() > 48 * 3600 * 1000;
  };

  return (
    <Card>
      <h3 className="mb-4 text-sm font-semibold text-foreground">Linha do Tempo</h3>
      <ol className="relative space-y-4 border-l border-border pl-6">
        {etapas.map((e, i) => {
          const concluida = !!e.data;
          const isAtraso = atraso(i);
          const corIcon = isAtraso
            ? "bg-destructive text-destructive-foreground"
            : concluida
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground";
          const corTexto = isAtraso
            ? "text-destructive"
            : concluida
            ? "text-foreground"
            : "text-muted-foreground";
          return (
            <li key={e.label} className="relative">
              <span
                className={`absolute -left-[34px] flex h-6 w-6 items-center justify-center rounded-full ${corIcon}`}
              >
                <e.icon className="h-3.5 w-3.5" />
              </span>
              <p className={`text-sm font-medium ${corTexto}`}>{e.label}</p>
              <p className={`text-xs ${corTexto}`}>{fmt(e.data)}</p>
              {isAtraso && (
                <p className="mt-0.5 text-[11px] font-medium text-destructive">
                  Etapa em atraso (&gt; 48h)
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
