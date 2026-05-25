import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, Card, Button } from "@/components/ui-bits";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/review-queue")({
  component: ReviewQueuePage,
});

type Caso = {
  id: string;
  codigo: string;
  criado_em: string;
  cliente: { nome: string } | null;
  agente: { nome: string } | null;
};

function ReviewQueuePage() {
  const [queue, setQueue] = useState<Caso[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("casos")
        .select("id, codigo, criado_em, cliente:clientes(nome), agente:profiles!agente_id(nome)")
        .eq("status", "aguardando_revisao")
        .order("criado_em", { ascending: false });
      setQueue((data ?? []) as unknown as Caso[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <PageHeader
        title="Fila de revisão"
        description="Casos aguardando análise e aprovação."
      />
      {loading ? (
        <Card><p className="text-sm text-muted-foreground">Carregando...</p></Card>
      ) : queue.length === 0 ? (
        <Card><p className="text-sm text-muted-foreground">Nenhum caso aguardando revisão.</p></Card>
      ) : (
        <div className="space-y-3">
          {queue.map((c) => (
            <Card key={c.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{c.codigo} · {c.cliente?.nome ?? "—"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Enviado em {new Date(c.criado_em).toLocaleDateString("pt-BR")} · Agente {c.agente?.nome ?? "—"}
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
