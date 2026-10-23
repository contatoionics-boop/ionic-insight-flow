import { useCallback, useEffect, useState } from "react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, BellRing, LogOut, Route as RouteIcon, User } from "lucide-react";

import { NotificacoesBell } from "@/components/NotificacoesBell";
import { useAuth } from "@/hooks/use-auth";
import { useConfiguracoesEmpresa } from "@/hooks/use-configuracoes-empresa";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";
import { listarAgendamentosDoAgente } from "@/lib/agendamentos.functions";
import { useServerFn } from "@tanstack/react-start";

type TabItem = {
  to: string;
  search?: { aba: "aceitar" };
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Marca a aba ativa a partir do endereço atual. */
  ativa: (pathname: string, aba: string | undefined) => boolean;
  /** Contador no canto do ícone (ex.: agendamentos a aceitar). */
  contador?: boolean;
};

const tabs: TabItem[] = [
  {
    to: "/app/minhas-vistorias",
    search: { aba: "aceitar" },
    label: "A aceitar",
    icon: BellRing,
    ativa: (p, aba) => p.startsWith("/app/minhas-vistorias") && aba === "aceitar",
    contador: true,
  },
  {
    to: "/app/minhas-vistorias",
    label: "Roteiro",
    icon: RouteIcon,
    ativa: (p, aba) => p.startsWith("/app/minhas-vistorias") && aba !== "aceitar",
  },
  { to: "/app/agente-perfil", label: "Perfil", icon: User, ativa: (p) => p.startsWith("/app/agente-perfil") },
];

export function AgentMobileLayout() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { config } = useConfiguracoesEmpresa();
  useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const aba = useRouterState({ select: (s) => (s.location.search as { aba?: string } | undefined)?.aba });
  const carregarAgendamentos = useServerFn(listarAgendamentosDoAgente);
  const [aAceitar, setAAceitar] = useState(0);

  // Quantos agendamentos aguardam o aceite do agente (contador da aba "A aceitar").
  const recontar = useCallback(async () => {
    try {
      const ags = await carregarAgendamentos();
      setAAceitar((ags ?? []).filter((a) => a.aceite_status === "aguardando_aceite").length);
    } catch {
      // sem contador: a aba continua funcionando
    }
  }, [carregarAgendamentos]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    void recontar();
    window.addEventListener("agente:aceite-mudou", recontar);
    return () => window.removeEventListener("agente:aceite-mudou", recontar);
  }, [auth.status, pathname, recontar]);
  const nomeEmpresa = config?.nome_empresa || "Ionics";
  const displayName = auth.profile?.nome || auth.email || "Agente";
  // Preenchendo um mapeamento: a barra inferior própria do checklist ocupa o rodapé.
  const emVistoria = pathname.startsWith("/app/vistoria/");

  useEffect(() => {
    if (auth.status === "unauthenticated") navigate({ to: "/" });
  }, [auth.status, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header
        className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card px-4"
        style={{ paddingTop: "max(env(safe-area-inset-top), 0.5rem)", paddingBottom: "0.5rem" }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {emVistoria && (
            <Link
              to="/app/minhas-vistorias"
              aria-label="Voltar para meus mapeamentos"
              className="-ml-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-foreground hover:bg-muted"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
          )}
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
            onClick={handleLogout}
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-foreground hover:bg-muted"
            aria-label="Sair"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main
        className="flex-1 px-3 py-4"
        style={{
          paddingBottom: emVistoria
            ? "calc(env(safe-area-inset-bottom) + 0.5rem)"
            : "calc(env(safe-area-inset-bottom) + 5.5rem)",
        }}
      >
        <Outlet />
      </main>

      {!emVistoria && (
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          {tabs.map((t) => {
            const active = t.ativa(pathname, aba);
            const Icon = t.icon;
            return (
              <Link
                key={t.label}
                to={t.to}
                search={t.search as never}
                className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  {t.contador && aAceitar > 0 && (
                    <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
                      {aAceitar}
                    </span>
                  )}
                </span>
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
      )}
    </div>
  );
}
