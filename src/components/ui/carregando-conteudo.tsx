import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function CarregandoConteudo({ texto = "Carregando…", className }: {
  texto?: string;
  className?: string;
}) {
  return (
    <div role="status" className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
      <Loader2 className="size-4 shrink-0 motion-safe:animate-spin" aria-hidden="true" />
      <span>{texto}</span>
    </div>
  );
}
