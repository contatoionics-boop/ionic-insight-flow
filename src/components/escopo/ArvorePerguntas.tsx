import { useState, type ReactNode } from "react";
import { CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { GrupoArvore, NoArvore } from "@/lib/escopo/arvore-perguntas";

/**
 * Árvore recolhível das entidades do Escopo (Posto › Ilha › Bomba › Bico,
 * Comboios, Frota/DIV). O conteúdo de cada nó (as perguntas) vem do chamador.
 */
export function ArvorePerguntas<P>({
  grupos,
  renderPerguntas,
}: {
  grupos: GrupoArvore<P>[];
  renderPerguntas: (perguntas: P[]) => ReactNode;
}) {
  if (!grupos.length) return null;
  return (
    <div className="space-y-6">
      {grupos.map((g) => (
        <section key={g.chave} className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.titulo}</h3>
          <div className="space-y-3">
            {g.nos.map((no) => (
              <No key={no.entidade.id} no={no} nivel={0} renderPerguntas={renderPerguntas} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function No<P>({
  no,
  nivel,
  renderPerguntas,
}: {
  no: NoArvore<P>;
  nivel: number;
  renderPerguntas: (perguntas: P[]) => ReactNode;
}) {
  const { total, respondidas } = no.contagem;
  const completo = total > 0 && respondidas >= total;
  // Abre o que ainda tem pendência; o que já está completo começa recolhido.
  const [aberto, setAberto] = useState(!completo);
  const caminho = no.ancestrais.map((a) => a.rotulo).join(" › ");

  return (
    <div
      className={cn(
        "rounded-xl border bg-card",
        nivel === 0 ? "border-border shadow-sm" : "border-border/70",
        completo && "border-emerald-500/30",
      )}
    >
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-3 text-left"
        aria-expanded={aberto}
      >
        {aberto ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1">
          {caminho && <span className="block truncate text-[11px] text-muted-foreground">{caminho}</span>}
          <span className="block truncate text-sm font-semibold text-foreground">{no.entidade.rotulo}</span>
        </span>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
            completo ? "bg-emerald-500/15 text-emerald-600" : "bg-primary/10 text-primary",
          )}
        >
          {completo && <CheckCircle2 className="h-3 w-3" />}
          {respondidas} de {total} respondidas
        </span>
      </button>

      {aberto && (
        <div className="space-y-3 border-t border-border/60 px-3 pb-3 pt-3">
          {no.perguntas.length > 0 && <div className="space-y-3">{renderPerguntas(no.perguntas)}</div>}
          {no.filhos.length > 0 && (
            <div className="space-y-3 border-l-2 border-primary/25 pl-3">
              {no.filhos.map((f) => (
                <No key={f.entidade.id} no={f} nivel={nivel + 1} renderPerguntas={renderPerguntas} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
