import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Card, PageHeader, Button } from "@/components/ui-bits";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { roleLabels } from "@/lib/auth";
import { LogOut } from "lucide-react";

export const Route = createFileRoute("/app/agente-perfil")({
  component: PerfilPage,
});

function PerfilPage() {
  const auth = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  const initials = (auth.profile?.nome || auth.email || "U")
    .split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  return (
    <div className="space-y-4">
      <PageHeader title="Perfil" description="Suas informações de conta." />
      <Card>
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">{auth.profile?.nome || "—"}</p>
            <p className="truncate text-sm text-muted-foreground">{auth.email}</p>
            {auth.role && (
              <p className="mt-0.5 text-xs text-muted-foreground">{roleLabels[auth.role]}</p>
            )}
          </div>
        </div>
      </Card>

      <Button variant="destructive" className="w-full" onClick={handleLogout}>
        <LogOut className="mr-2 h-4 w-4" /> Sair
      </Button>
    </div>
  );
}
