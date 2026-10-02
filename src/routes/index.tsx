import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { roleLabels, routeForRole, traduzirErroAuth, type Role } from "@/lib/auth";
import { Button, Input, Label } from "@/components/ui-bits";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IONICS | Acesso ao sistema" },
      { name: "description", content: "Acesse a plataforma IONICS para gerenciar mapeamentos técnicos." },
      { property: "og:title", content: "IONICS | Acesso ao sistema" },
      { property: "og:description", content: "Acesse a plataforma IONICS para gerenciar mapeamentos técnicos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search.redirect === "string" ? { redirect: search.redirect } : {},

  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect: redirectTo } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const goAfterLogin = async () => {
    if (redirectTo && redirectTo.startsWith("/")) {
      window.location.assign(redirectTo);
      return;
    }
    const { data: roleData } = await supabase.rpc("current_user_role");
    navigate({ to: routeForRole((roleData as Role | null) ?? null) });
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      await goAfterLogin();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      setLoading(false);
      setError(traduzirErroAuth(error?.message, "Não foi possível entrar."));
      return;
    }
    setSuccess(true);
    // Aguarda o círculo cobrir a tela antes de navegar
    setTimeout(() => {
      void goAfterLogin();
    }, 700);
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
      setError(traduzirErroAuth(error.message));
      return;
    }
    setInfo("E-mail de redefinição enviado. Verifique sua caixa de entrada.");
  };

  return (
    <div className="relative grid min-h-screen overflow-hidden md:grid-cols-2">
      {/* Transição de sucesso: círculo que se expande do centro e cobre a tela */}
      <div
        aria-hidden
        className={`pointer-events-none fixed left-1/2 top-1/2 z-50 h-[250vmax] w-[250vmax] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary transition-transform duration-700 ease-in-out ${
          success ? "scale-100" : "scale-0"
        }`}
      />
      <div
        className={`pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 text-primary-foreground transition-opacity duration-300 ${
          success ? "opacity-100 delay-500" : "opacity-0"
        }`}
      >
        <CheckCircle2 className="h-10 w-10" />
        <p className="text-lg font-semibold">Bem-vindo de volta</p>
        <p className="text-sm text-primary-foreground/80">Entrando na plataforma...</p>
      </div>

      {/* Painel lateral de marca */}
      <div className="relative z-20 hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground md:flex">
        {/* Glow decorativo */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/20 opacity-60 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-primary/10 opacity-50 blur-3xl"
        />

        <span className="relative text-2xl font-bold tracking-tight text-sidebar-foreground">
          IONICS
        </span>

        <div className="relative">
          <h2 className="text-3xl font-semibold leading-tight">Portal de Mapeamento Técnico IONICS</h2>
          <p className="mt-3 max-w-md text-sm text-sidebar-foreground/70">
            Acesse sua conta para registrar e acompanhar os mapeamentos técnicos no campo.
          </p>
        </div>

        <p className="relative text-xs text-sidebar-foreground/50">© 2026 IONICS</p>
      </div>

      {/* Painel do formulário */}
      <div className="relative z-10 flex items-center justify-center bg-background p-6">
        <form
          onSubmit={mode === "login" ? handleLogin : handleForgot}
          className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm"
        >
          <div className="mb-6 flex justify-center md:hidden">
            <span className="text-2xl font-bold tracking-tight text-primary">IONICS</span>
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
            Agentes técnicos fazem login com as credenciais recebidas por e-mail.
          </p>
          <p className="mt-2 text-center text-[10px] text-muted-foreground/70">
            Perfis: {Object.values(roleLabels).join(" · ")}
          </p>
        </form>
      </div>
    </div>
  );
}
