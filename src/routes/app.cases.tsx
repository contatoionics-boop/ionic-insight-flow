import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, Table, Th, Td, Badge } from "@/components/ui-bits";
import { statusLabels, statusTones, type CaseStatus } from "@/lib/casos";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/cases")({
  component: CasesPage,
});

type Caso = {
  id: string;
  codigo: string;
  status: CaseStatus;
  criado_em: string;
  cliente: { nome: string } | null;
  agente: { nome: string } | null;
};

function CasesPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Caso[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("casos")
        .select("id, codigo, status, criado_em, cliente:clientes(nome), agente:profiles!agente_id(nome)")
        .order("criado_em", { ascending: false });
      setRows((data ?? []) as unknown as Caso[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <PageHeader title="Vistorias" description="Todas as vistorias da plataforma. Clique em uma linha para ver detalhes." />
      <Table>
        <thead>
          <tr>
            <Th>ID</Th>
            <Th>Cliente</Th>
            <Th>Agente</Th>
            <Th>Status</Th>
            <Th>Data</Th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">Carregando...</td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhuma vistoria registrada ainda.</td></tr>
          ) : (
            rows.map((c) => (
              <tr
                key={c.id}
                onClick={() => navigate({ to: "/app/vistorias/$id", params: { id: c.id } })}
                className="cursor-pointer transition-colors hover:bg-muted/50"
              >
                <Td className="font-mono text-xs">{c.codigo}</Td>
                <Td className="font-medium">{c.cliente?.nome ?? "—"}</Td>
                <Td>{c.agente?.nome ?? "—"}</Td>
                <Td><Badge className={statusTones[c.status]}>{statusLabels[c.status]}</Badge></Td>
                <Td>{new Date(c.criado_em).toLocaleDateString("pt-BR")}</Td>
              </tr>
            ))
          )}
        </tbody>
      </Table>
    </div>
  );
}
