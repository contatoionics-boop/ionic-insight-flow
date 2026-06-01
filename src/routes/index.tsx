import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { roleLabels, routeForRole, type Role } from "@/lib/auth";
import { Button, Input, Label } from "@/components/ui-bits";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Redireciona se já estiver logado
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data: roleData } = await supabase.rpc("current_user_role");
      navigate({ to: routeForRole((roleData as Role | null) ?? null) });
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      setLoading(false);
      setError(error?.message ?? "Não foi possível entrar.");
      return;
    }
    const { data: roleData } = await supabase.rpc("current_user_role");
    const role = (roleData as Role | null) ?? null;
    setLoading(false);
    navigate({ to: routeForRole(role) });
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setInfo("E-mail de redefinição enviado. Verifique sua caixa de entrada.");
  };

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground md:flex">
        <span className="text-2xl font-bold tracking-tight text-sidebar-foreground">Ionics</span>
        <div>
          <h2 className="text-3xl font-semibold leading-tight">Ionics</h2>
          <p className="mt-3 max-w-md text-sm text-sidebar-foreground/70">Ionics</p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">© 2026 Ionics</p>
      </div>

      <div className="flex items-center justify-center bg-background p-6">
        <form
          onSubmit={mode === "login" ? handleLogin : handleForgot}
          className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm"
        >
          <div className="mb-6 flex justify-center md:hidden">
            <span className="text-2xl font-bold tracking-tight text-primary">Ionics</span>
          </div>
          <h1 className="text-xl font-semibold text-foreground">
            {mode === "login" ? "Entrar na plataforma" : "Redefinir senha"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login"
              ? "Acesse com seu e-mail corporativo."
              : "Enviaremos um link para redefinir sua senha."}
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {mode === "login" && (
              <div>
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}
            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
            )}
            {info && (
              <p className="rounded-md bg-success/10 px-3 py-2 text-xs text-success">{info}</p>
            )}
          </div>

          <Button type="submit" className="mt-6 w-full" disabled={loading}>
            {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Enviar link"}
          </Button>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setInfo(null);
              setMode(mode === "login" ? "forgot" : "login");
            }}
            className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            {mode === "login" ? "Esqueci minha senha" : "← Voltar ao login"}
          </button>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Agentes técnicos não fazem login — acessam via link público enviado por e-mail.
          </p>
          <p className="mt-2 text-center text-[10px] text-muted-foreground/70">
            Perfis: {Object.values(roleLabels).join(" · ")}
          </p>
        </form>
      </div>
    </div>
  );
}
