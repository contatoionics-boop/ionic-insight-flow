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
  unidade: { nome: string; matriz: { nome: string; empresa: { nome: string } | null } | null } | null;
  agente: { nome: string } | null;
};

function ReviewQueuePage() {
  const [queue, setQueue] = useState<Caso[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("casos")
        .select("id, codigo, criado_em, unidade:unidades(nome, matriz:matrizes(nome, empresa:empresas(nome))), agente:profiles!agente_id(nome)")
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
        description="Mapeamentos aguardando análise e aprovação."
      />
      {loading ? (
        <Card><p className="text-sm text-muted-foreground">Carregando...</p></Card>
      ) : queue.length === 0 ? (
        <Card><p className="text-sm text-muted-foreground">Nenhum mapeamento aguardando revisão.</p></Card>
      ) : (
        <div className="space-y-3">
          {queue.map((c) => (
            <Card key={c.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{c.codigo} · {c.unidade?.matriz?.empresa?.nome ?? "—"}{c.unidade?.nome ? ` · ${c.unidade.nome}` : ""}</p>
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
