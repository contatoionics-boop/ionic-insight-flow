import type { ButtonHTMLAttributes, ReactNode } from "react";

/** Rótulo de seção (caixa alta, discreto), como no desenho do agente. */
export function Rotulo({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">{children}</h2>
  );
}

export function Meta({ icone, children }: { icone: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-xs leading-4 text-muted-foreground">
      <span className="mt-px shrink-0">{icone}</span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

/** Botão de 44 px (alvo de toque confortável). */
export function Botao({
  variante,
  children,
  ...props
}: {
  variante: "primario" | "contorno";
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-center text-sm font-semibold transition-colors disabled:cursor-not-allowed";
  const cor =
    variante === "primario"
      ? "border-transparent bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
      : "border-border bg-card text-foreground hover:bg-muted disabled:text-muted-foreground";
  return (
    <button type="button" {...props} className={`${base} ${cor}`}>
      {children}
    </button>
  );
}
