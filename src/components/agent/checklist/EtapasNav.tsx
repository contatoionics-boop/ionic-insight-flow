import { Check, Circle, CircleAlert, CircleDot } from "lucide-react";

import { rotuloStatus, type ResumoEtapa, type StatusEtapa } from "@/lib/vistoria-checklist";

const cores: Record<StatusEtapa, string> = {
  nao_iniciada: "text-muted-foreground",
  incompleta: "text-primary",
  pendente: "text-destructive",
  concluida: "text-emerald-600",
};

/**
 * Rótulo da etapa na lista. Títulos que já começam com a própria numeração
 * ("2 - Descrição...", "1.1 - Registro...") não ganham a posição na frente,
 * para não aparecer "4. 2 - Descrição...".
 */
function rotuloEtapa(indice: number, titulo: string) {
  return /^\s*\d+(\.\d+)*\s*[-–.)]/.test(titulo) ? titulo : `${indice + 1}. ${titulo}`;
}

export function IconeStatus({ status, className = "h-4 w-4" }: { status: StatusEtapa; className?: string }) {
  const Icon =
    status === "concluida" ? Check : status === "pendente" ? CircleAlert : status === "incompleta" ? CircleDot : Circle;
  return <Icon className={`${className} ${cores[status]}`} aria-hidden />;
}

type Props = {
  etapas: ResumoEtapa[];
  atual: number;
  onSelecionar: (indice: number) => void;
};

export function EtapasNav({ etapas, atual, onSelecionar }: Props) {
  return (
    <>
      {/* Desktop: lista vertical */}
      <nav className="hidden lg:block" aria-label="Etapas do mapeamento">
        <ol className="space-y-1">
          {etapas.map((e, i) => (
            <li key={e.etapa.id}>
              <button
                type="button"
                onClick={() => onSelecionar(i)}
                aria-current={i === atual ? "step" : undefined}
                className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  i === atual ? "bg-muted font-semibold text-foreground" : "text-muted-foreground hover:bg-muted/60"
                }`}
              >
                <IconeStatus status={e.status} className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    {rotuloEtapa(i, e.etapa.titulo)}
                  </span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {e.respondidas}/{e.visiveis.length} · {rotuloStatus[e.status]}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {/* Mobile: stepper horizontal */}
      <div className="lg:hidden">
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Etapas do mapeamento">
          {etapas.map((e, i) => (
            <button
              key={e.etapa.id}
              type="button"
              role="tab"
              aria-selected={i === atual}
              onClick={() => onSelecionar(i)}
              className={`flex min-h-10 max-w-[13rem] shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium ${
                i === atual
                  ? "border-primary/60 bg-primary/10 text-foreground"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              <IconeStatus status={e.status} className="h-3.5 w-3.5" />
              <span className="truncate">
                {rotuloEtapa(i, e.etapa.titulo)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
