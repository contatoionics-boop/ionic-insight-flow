import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, StatCard, Card, Badge } from "@/components/ui-bits";
import { statusLabels, statusTones, type CaseStatus } from "@/lib/casos";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/dashboard")({
  component: DashboardPage,
});

type Recent = {
  id: string;
  codigo: string;
  status: CaseStatus;
  criado_em: string;
  cliente: { nome: string } | null;
};

function DashboardPage() {
  const [stats, setStats] = useState({ abertos: 0, revisao: 0, aprovados: 0, agentes: 0 });
  const [recent, setRecent] = useState<Recent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: casos }, agentes] = await Promise.all([
        supabase
          .from("casos")
          .select("id, codigo, status, criado_em, cliente:clientes(nome)")
          .order("criado_em", { ascending: false }),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "agente_tecnico"),
      ]);
      const list = (casos ?? []) as unknown as Recent[];
      setRecent(list.slice(0, 6));
      setStats({
        abertos: list.filter((c) => c.status !== "aprovado").length,
        revisao: list.filter((c) => c.status === "aguardando_revisao").length,
        aprovados: list.filter((c) => c.status === "aprovado").length,
        agentes: agentes.count ?? 0,
      });
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Visão geral da operação de pós-vistoria."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Casos abertos" value={stats.abertos} hint="Em andamento" />
        <StatCard label="Aguardando revisão" value={stats.revisao} hint="Fila do especialista" />
        <StatCard label="Aprovados" value={stats.aprovados} hint="Total no sistema" />
        <StatCard label="Agentes ativos" value={stats.agentes} hint="Em campo" />
      </div>

      <div className="mt-8">
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-foreground">Casos recentes</h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum caso registrado ainda.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {c.codigo} · {c.cliente?.nome ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(c.criado_em).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <Badge className={statusTones[c.status]}>{statusLabels[c.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
