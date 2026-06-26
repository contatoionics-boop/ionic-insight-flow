import { useEffect } from "react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { ClipboardList, LogOut, Moon, Sun, User } from "lucide-react";

import { NotificacoesBell } from "@/components/NotificacoesBell";
import { useAuth } from "@/hooks/use-auth";
import { useConfiguracoesEmpresa } from "@/hooks/use-configuracoes-empresa";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";

type TabItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }> };

const tabs: TabItem[] = [
  { to: "/app/minhas-vistorias", label: "Mapeamentos", icon: ClipboardList },
  { to: "/app/agente-perfil", label: "Perfil", icon: User },
];

export function AgentMobileLayout() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { config } = useConfiguracoesEmpresa();
  const { theme, toggle: toggleTheme } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const nomeEmpresa = config?.nome_empresa || "Ionics";
  const displayName = auth.profile?.nome || auth.email || "Agente";

  useEffect(() => {
    if (auth.status === "unauthenticated") navigate({ to: "/" });
  }, [auth.status, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header
        className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card px-4"
        style={{ paddingTop: "max(env(safe-area-inset-top), 0.5rem)", paddingBottom: "0.5rem" }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {config?.logo_url ? (
            <img src={config.logo_url} alt={nomeEmpresa} className="h-7 w-auto object-contain" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              {nomeEmpresa.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{nomeEmpresa}</p>
            <p className="truncate text-[11px] text-muted-foreground">{displayName}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <NotificacoesBell />
          <button
            onClick={toggleTheme}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground hover:bg-muted"
            aria-label="Alternar tema"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button
            onClick={handleLogout}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground hover:bg-muted"
            aria-label="Sair"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main
        className="flex-1 px-3 py-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 5.5rem)" }}
      >
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          {tabs.map((t) => {
            const active = pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
