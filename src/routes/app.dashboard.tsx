import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatCard, Card, Badge } from "@/components/ui-bits";
import { cases, statusLabels, statusTones } from "@/lib/mock-data";

export const Route = createFileRoute("/app/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const abertos = cases.filter((c) => c.status !== "aprovado").length;
  const revisao = cases.filter((c) => c.status === "revisao").length;
  const aprovados = cases.filter((c) => c.status === "aprovado").length;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Visão geral da operação de pós-vistoria."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Casos abertos" value={abertos} hint="Em andamento" />
        <StatCard label="Aguardando revisão" value={revisao} hint="Fila do especialista" />
        <StatCard label="Aprovados no mês" value={aprovados} hint="Maio / 2026" />
        <StatCard label="Agentes ativos" value={8} hint="Em campo" />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Casos recentes</h3>
          <ul className="divide-y divide-border">
            {cases.slice(0, 6).map((c) => (
              <li key={c.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{c.id} · {c.clientName}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.agent} · {new Date(c.date).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <Badge className={statusTones[c.status]}>{statusLabels[c.status]}</Badge>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-foreground">Tempo médio</h3>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">Coleta em campo</p>
              <p className="text-2xl font-semibold text-foreground">42 min</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Processamento IA</p>
              <p className="text-2xl font-semibold text-foreground">2,8 min</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Revisão do especialista</p>
              <p className="text-2xl font-semibold text-foreground">11 min</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
