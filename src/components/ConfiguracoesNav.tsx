import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Building2, Users, Sparkles, Send, BookOpen, Package, LayoutTemplate, Cpu, Layers, ListChecks } from "lucide-react";

const items = [
  { to: "/app/configuracoes", label: "Empresa", icon: Building2 },
  { to: "/app/users", label: "Usuários", icon: Users },
  { to: "/app/prompts", label: "Prompts de IA", icon: Sparkles },
  { to: "/app/base-conhecimento", label: "Base de conhecimento", icon: BookOpen },
  { to: "/app/catalogo-materiais", label: "Catálogo de materiais", icon: Package },
  { to: "/app/catalogo-equipamentos", label: "Catálogo de equipamentos", icon: Cpu },
  { to: "/app/blocos-padrao", label: "Blocos padrão", icon: LayoutTemplate },
  { to: "/app/tipos-escopo", label: "Tipos de item", icon: Layers },
  { to: "/app/opcoes-agendamento", label: "Opções do agendamento", icon: ListChecks },
  { to: "/app/outputs", label: "Saídas", icon: Send },
] as const;

export function ehSecaoConfiguracoes(caminho: string) {
  return items.some((item) => item.to === caminho);
}

export function ConfiguracoesNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const atual = items.find((item) => item.to === pathname);
  return (
    <nav aria-label="Configurações" className="mb-6">
      <label className="block text-xs font-medium text-muted-foreground lg:hidden">
        Seção de Configurações
        <select
          value={atual?.to ?? ""}
          onChange={(event) => {
            const item = items.find((opcao) => opcao.to === event.currentTarget.value);
            if (item) void navigate({ to: item.to });
          }}
          className="mt-1 block h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
          {!atual && <option value="" disabled>Escolha uma seção</option>}
          {items.map((item) => <option key={item.to} value={item.to}>{item.label}</option>)}
        </select>
      </label>
      <div className="hidden flex-wrap gap-1 border-b border-border lg:flex">
        {items.map((it) => {
          const active = pathname === it.to;
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              preload="intent"
              aria-current={active ? "page" : undefined}
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
    </nav>
  );
}
