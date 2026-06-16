import { Link, useRouterState } from "@tanstack/react-router";
import { Building2, Users, Sparkles, Send, BookOpen } from "lucide-react";

const items = [
  { to: "/app/configuracoes", label: "Empresa", icon: Building2 },
  { to: "/app/users", label: "Usuários", icon: Users },
  { to: "/app/prompts", label: "Prompts de IA", icon: Sparkles },
  { to: "/app/base-conhecimento", label: "Base de conhecimento", icon: BookOpen },
  { to: "/app/outputs", label: "Saídas", icon: Send },
];

export function ConfiguracoesNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="mb-6 flex flex-wrap gap-1 border-b border-border">
      {items.map((it) => {
        const active = pathname === it.to;
        const Icon = it.icon;
        return (
          <Link
            key={it.to}
            to={it.to}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}
