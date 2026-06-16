import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  FolderKanban,
  FileText,
  PlusCircle,
  ListChecks,
  ClipboardCheck,
  History,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sun,
  CalendarDays,
  ClipboardList,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { NotificacoesBell } from "@/components/NotificacoesBell";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { roleLabels, type Role } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";
import { useConfiguracoesEmpresa } from "@/hooks/use-configuracoes-empresa";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }> };

const navByRole: Record<Role, NavItem[]> = {
  super_admin: [
    { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/app/clients", label: "Clientes", icon: Building2 },
    { to: "/app/agenda", label: "Agenda", icon: CalendarDays },
    { to: "/app/new-case", label: "Agendar mapeamento", icon: PlusCircle },
    { to: "/app/cases", label: "Mapeamentos", icon: FolderKanban },
    { to: "/app/forms", label: "Formulários", icon: FileText },
    { to: "/app/configuracoes", label: "Configurações", icon: Settings },
  ],
  admin: [
    { to: "/app/clients", label: "Clientes", icon: Building2 },
    { to: "/app/new-case", label: "Agendar mapeamento", icon: PlusCircle },
    { to: "/app/agenda", label: "Agenda", icon: CalendarDays },
    { to: "/app/tracking", label: "Acompanhamento", icon: ListChecks },
  ],
  especialista: [
    { to: "/app/review-queue", label: "Fila de revisão", icon: ClipboardCheck },
    { to: "/app/history", label: "Histórico", icon: History },
  ],
  agente_tecnico: [
    { to: "/app/minhas-vistorias", label: "Meus mapeamentos", icon: ClipboardList },
  ],
};

const SIDEBAR_KEY = "app.sidebar.collapsed";

export function AppLayout() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { config } = useConfiguracoesEmpresa();
  const { theme, toggle: toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_KEY) === "1";
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
    } catch {}
  }, [collapsed]);

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const nomeEmpresa = config?.nome_empresa || "Ionics";

  useEffect(() => {
    if (auth.status === "unauthenticated") {
      const target = pathname && pathname !== "/" ? pathname + (window.location.search || "") : undefined;
      navigate({ to: "/", search: target ? { redirect: target } : undefined });
    }
  }, [auth.status, navigate, pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (auth.status !== "authenticated" || !auth.role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  const nav = navByRole[auth.role];
  const displayName = auth.profile?.nome || auth.email || "Usuário";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex min-h-screen bg-background">
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex transform flex-col bg-sidebar text-sidebar-foreground transition-[width,transform] duration-200 ease-in-out md:relative md:translate-x-0 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          } ${collapsed ? "w-16" : "w-64"}`}
        >
          <div
            className={`relative flex h-16 shrink-0 items-center border-b border-sidebar-border ${
              collapsed ? "justify-center px-2" : "justify-between px-5"
            }`}
          >
            <div className={`flex items-center gap-2 overflow-hidden ${collapsed ? "justify-center" : ""}`}>
              {config?.logo_url ? (
                <img
                  src={config.logo_url}
                  alt={nomeEmpresa}
                  className="h-7 w-auto shrink-0 object-contain"
                />
              ) : (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sidebar-active text-xs font-bold text-sidebar-accent-foreground">
                  {nomeEmpresa.charAt(0).toUpperCase()}
                </div>
              )}
              {!collapsed && (
                <span className="truncate text-lg font-bold tracking-tight text-sidebar-foreground">
                  {nomeEmpresa}
                </span>
              )}
            </div>
            {!collapsed && (
              <button
                className="text-sidebar-foreground md:hidden"
                onClick={() => setMobileOpen(false)}
                aria-label="Fechar menu"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          <nav className={`flex flex-1 flex-col gap-0.5 overflow-y-auto py-4 ${collapsed ? "px-2" : "px-3"}`}>
            {nav.map((item) => {
              const active = pathname.startsWith(item.to);
              const Icon = item.icon;
              const linkClass = `group relative flex items-center rounded-md text-sm font-medium transition-all ${
                collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"
              } ${
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              }`;
              const linkNode = (
                <Link key={item.to} to={item.to} className={linkClass}>
                  <span
                    className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-sidebar-active transition-opacity ${
                      active ? "opacity-100" : "opacity-0"
                    }`}
                    aria-hidden
                  />
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-colors ${
                      active
                        ? "text-sidebar-active"
                        : "text-sidebar-foreground/60 group-hover:text-sidebar-accent-foreground"
                    }`}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
              if (!collapsed) return linkNode;
              return (
                <Tooltip key={item.to}>
                  <TooltipTrigger asChild>{linkNode}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            })}
          </nav>

          <div className={`shrink-0 border-t border-sidebar-border ${collapsed ? "p-2" : "p-3"}`}>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-active text-sm font-semibold text-sidebar-accent-foreground">
                    {initials}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {displayName} · {roleLabels[auth.role]}
                </TooltipContent>
              </Tooltip>
            ) : (
              <div className="flex items-center gap-3 rounded-md px-2 py-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-active text-sm font-semibold text-sidebar-accent-foreground">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-sidebar-foreground">{displayName}</p>
                  <p className="truncate text-xs text-sidebar-foreground/60">{roleLabels[auth.role]}</p>
                </div>
              </div>
            )}
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleLogout}
                    className="mt-2 flex w-full items-center justify-center rounded-md border border-sidebar-border bg-sidebar-accent/30 px-2 py-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    aria-label="Sair"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Sair</TooltipContent>
              </Tooltip>
            ) : (
              <button
                onClick={handleLogout}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/30 px-3 py-2 text-xs font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sair
              </button>
            )}
          </div>

          {/* Botão recolher / expandir — visível só no desktop */}
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="absolute -right-3 top-20 hidden h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-card text-foreground shadow-sm transition-colors hover:bg-muted md:flex"
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card px-4 md:px-6">
            <div className="flex items-center gap-3">
              <button className="md:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-sm font-semibold text-foreground">{nomeEmpresa}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NotificacoesBell />
              <button
                onClick={toggleTheme}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:bg-muted"
                aria-label={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
                title={theme === "dark" ? "Tema claro" : "Tema escuro"}
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-8">
            <Outlet />
          </main>
        </div>

        {mobileOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
