import { Eye, Pencil, Trash2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function IconeDecorativo({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return <Icon aria-hidden="true" className={cn("size-4 shrink-0", className)} />;
}

export function IconeEditar({ className }: { className?: string }) {
  return <IconeDecorativo icon={Pencil} className={className} />;
}

export function IconeVisualizar({ className }: { className?: string }) {
  return <IconeDecorativo icon={Eye} className={className} />;
}

export function IconeExcluir({ className }: { className?: string }) {
  return <IconeDecorativo icon={Trash2} className={className} />;
}
