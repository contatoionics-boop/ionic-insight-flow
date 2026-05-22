import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import logo from "@/assets/ionics-logo.png";
import { Button, Input, Label } from "@/components/ui-bits";
import { supabase } from "@/integrations/supabase/client";
import { routeForRole, type Role } from "@/lib/auth";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Supabase coloca o usuário em sessão automaticamente quando ele clica no link de recuperação.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }
    const { data: roleData } = await supabase.rpc("current_user_role");
    setLoading(false);
    navigate({ to: routeForRole((roleData as Role | null) ?? null) });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <img src={logo} alt="IONICS" className="mx-auto mb-6 h-9 w-auto rounded-md bg-sidebar p-2" />
        <h1 className="text-xl font-semibold text-foreground">Defina sua senha</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crie uma senha de pelo menos 8 caracteres para acessar a plataforma.
        </p>

        {!ready ? (
          <p className="mt-6 text-sm text-muted-foreground">Validando link...</p>
        ) : (
          <div className="mt-6 space-y-4">
            <div>
              <Label htmlFor="password">Nova senha</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="confirm">Confirmar senha</Label>
              <Input
                id="confirm"
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Salvando..." : "Salvar senha e entrar"}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
