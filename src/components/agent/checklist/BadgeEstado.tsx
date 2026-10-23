import { AlertTriangle, CheckCircle2, Circle, CircleDot } from "lucide-react";

import { cn } from "@/lib/utils";
import type { EstadoEquip } from "@/lib/escopo/navegacao-entidades";

const CONFIG: Record<EstadoEquip, { rotulo: string; Icone: typeof Circle; classe: string }> = {
  nao_iniciada: { rotulo: "Não iniciada", Icone: Circle, classe: "bg-muted text-muted-foreground" },
  em_andamento: { rotulo: "Em andamento", Icone: CircleDot, classe: "bg-primary/10 text-primary" },
  concluida: { rotulo: "Concluída", Icone: CheckCircle2, classe: "bg-emerald-500/15 text-emerald-600" },
  com_pendencias: { rotulo: "Com pendências", Icone: AlertTriangle, classe: "bg-destructive/10 text-destructive" },
};

export function rotuloEstado(estado: EstadoEquip) {
  return CONFIG[estado].rotulo;
}

/** Crachá discreto com o estado do equipamento (ícone + texto). */
export function BadgeEstado({ estado, className }: { estado: EstadoEquip; className?: string }) {
  const { rotulo, Icone, classe } = CONFIG[estado];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        classe,
        className,
      )}
    >
      <Icone className="h-3 w-3" aria-hidden />
      {rotulo}
    </span>
  );
}

/** Estado agregado de um grupo (ilha, comboios...) a partir dos equipamentos. */
export function estadoDoGrupo(estados: EstadoEquip[]): EstadoEquip {
  if (estados.length === 0) return "nao_iniciada";
  if (estados.every((e) => e === "concluida")) return "concluida";
  if (estados.some((e) => e === "com_pendencias")) return "com_pendencias";
  if (estados.every((e) => e === "nao_iniciada")) return "nao_iniciada";
  return "em_andamento";
}
