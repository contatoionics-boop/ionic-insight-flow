import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Building2,
  FolderKanban,
  FileText,
  Sparkles,
  Send,
  PlusCircle,
  ListChecks,
  ClipboardCheck,
  History,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import logo from "@/assets/ionics-logo.png";
import { roleLabels, type Role } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }> };

const navByRole: Record<Role, NavItem[]> = {
  super_admin: [
    { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/app/users", label: "Usuários", icon: Users },
    { to: "/app/clients", label: "Clientes", icon: Building2 },
    { to: "/app/cases", label: "Casos", icon: FolderKanban },
    { to: "/app/forms", label: "Formulários", icon: FileText },
    { to: "/app/prompts", label: "Prompts de IA", icon: Sparkles },
    { to: "/app/outputs", label: "Saídas", icon: Send },
  ],
  admin: [
    { to: "/app/clients", label: "Clientes", icon: Building2 },
    { to: "/app/new-case", label: "Novo caso", icon: PlusCircle },
    { to: "/app/tracking", label: "Acompanhamento", icon: ListChecks },
  ],
  especialista: [
    { to: "/app/review-queue", label: "Fila de revisão", icon: ClipboardCheck },
    { to: "/app/history", label: "Histórico", icon: History },
  ],
  agente_tecnico: [],
};

export function AppLayout() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (auth.status === "unauthenticated") {
      navigate({ to: "/" });
    }
  }, [auth.status, navigate]);

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

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-sidebar text-sidebar-foreground transition-transform md:relative md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-5">
          <img src={logo} alt="IONICS" className="h-7 w-auto" />
          <button
            className="text-sidebar-foreground md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-col gap-1 px-3 py-4">
          {nav.map((item) => {
            const active = pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-sidebar-border p-4 text-xs text-sidebar-foreground/60">
          IONICS Pós-Vistoria · v0.1
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card px-4 md:px-6">
          <div className="flex items-center gap-3">
            <button className="md:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-sm font-semibold text-foreground">Pós-Vistoria</h1>
              <p className="text-xs text-muted-foreground">Plataforma interna IONICS</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">{displayName}</p>
              <p className="text-xs text-muted-foreground">{roleLabels[auth.role]}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {displayName
                .split(" ")
                .map((p) => p[0])
                .filter(Boolean)
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
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
  );
}
