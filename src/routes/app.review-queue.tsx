import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, Card, Button } from "@/components/ui-bits";
import { cases } from "@/lib/mock-data";

export const Route = createFileRoute("/app/review-queue")({
  component: ReviewQueuePage,
});

function ReviewQueuePage() {
  const queue = cases.filter((c) => c.status === "revisao");

  return (
    <div>
      <PageHeader
        title="Fila de revisão"
        description="Casos aguardando análise e aprovação."
      />
      {queue.length === 0 ? (
        <Card>
          <p className="text-sm text-muted-foreground">Nenhum caso aguardando revisão.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {queue.map((c) => (
            <Card key={c.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{c.id} · {c.clientName}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Enviado em {new Date(c.date).toLocaleDateString("pt-BR")} · Agente {c.agent}
                </p>
              </div>
              <Link to="/app/review/$id" params={{ id: c.id }}>
                <Button>Revisar</Button>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
