import { ChevronRight } from "lucide-react";

import { BadgeEstado } from "@/components/agent/checklist/BadgeEstado";
import { IconeTipo, corDoTipo } from "@/components/escopo/ResumoEscopo";
import { cn } from "@/lib/utils";
import { contarEstados, type Unidade } from "@/lib/escopo/navegacao-entidades";

/** Nível 2: equipamentos de uma ilha (ou comboios, tanques, sondas), um por linha. */
export function ListaEquipamentos({
  titulo,
  caminho,
  unidades,
  resumoDe,
  onAbrir,
}: {
  titulo: string;
  /** Contexto acima do título (ex.: "Posto 01"). */
  caminho?: string;
  unidades: Unidade[];
  /** Frase de progresso do grupo (ex.: "2 de 3 bombas concluídas"). */
  resumoDe: string;
  onAbrir: (id: string) => void;
}) {
  const c = contarEstados(unidades);
  return (
    <section className="space-y-3">
      <header>
        {caminho && <p className="text-xs text-muted-foreground">{caminho}</p>}
        <h2 className="text-lg font-semibold leading-tight text-foreground">{titulo}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{resumoDe}</p>
        {c.total > 1 && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.round((c.concluidas / c.total) * 100)}%` }} />
          </div>
        )}
      </header>

      <ul className="space-y-2">
        {unidades.map((u) => (
          <li key={u.id}>
            <button
              type="button"
              onClick={() => onAbrir(u.id)}
              className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left shadow-sm active:bg-muted"
            >
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border", corDoTipo(u.entidade.tipo))}>
                <IconeTipo tipo={u.entidade.tipo} className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">{u.tituloCompleto}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {u.respondidas} de {u.total} campos
                  {u.subs.length > 0 ? ` · ${u.subs.length} ${u.subs.length === 1 ? "item interno" : "itens internos"}` : ""}
                </span>
              </span>
              <BadgeEstado estado={u.estado} />
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
