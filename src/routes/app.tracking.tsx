import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, Table, Th, Td, Badge } from "@/components/ui-bits";
import { statusLabels, statusTones, type CaseStatus } from "@/lib/casos";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/app/tracking")({
  component: TrackingPage,
});

type Caso = {
  id: string;
  codigo: string;
  status: CaseStatus;
  criado_em: string;
  unidade: { nome: string; matriz: { nome: string; empresa: { nome: string } | null } | null } | null;
  agente: { nome: string } | null;
};

function TrackingPage() {
  const { userId, status } = useAuth();
  const [rows, setRows] = useState<Caso[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated" || !userId) return;
    (async () => {
      const { data } = await supabase
        .from("casos")
        .select("id, codigo, status, criado_em, unidade:unidades(nome, matriz:matrizes(nome, empresa:empresas(nome))), agente:profiles!agente_id(nome)")
        .eq("criado_por", userId)
        .order("criado_em", { ascending: false });
      setRows((data ?? []) as unknown as Caso[]);
      setLoading(false);
    })();
  }, [userId, status]);

  return (
    <div>
      <PageHeader
        title="Acompanhamento"
        description="Casos criados por você e seus status atuais."
      />
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
            <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">Você ainda não criou nenhum caso.</td></tr>
          ) : (
            rows.map((c) => (
              <tr key={c.id}>
                <Td className="font-mono text-xs">{c.codigo}</Td>
                <Td className="font-medium">{c.unidade?.matriz?.empresa?.nome ?? "—"}{c.unidade?.nome ? <span className="ml-1 text-xs text-muted-foreground">· {c.unidade.nome}</span> : null}</Td>
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
