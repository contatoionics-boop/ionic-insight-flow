import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, Table, Th, Td, Badge } from "@/components/ui-bits";
import { statusLabels, statusTones } from "@/lib/casos";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/history")({
  component: HistoryPage,
});

type Caso = {
  id: string;
  codigo: string;
  criado_em: string;
  unidade: { nome: string; matriz: { nome: string; empresa: { nome: string } | null } | null } | null;
  agente: { nome: string } | null;
};

function HistoryPage() {
  const [rows, setRows] = useState<Caso[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("casos")
        .select("id, codigo, criado_em, unidade:unidades(nome, matriz:matrizes(nome, empresa:empresas(nome))), agente:profiles!agente_id(nome)")
        .eq("status", "aprovado")
        .order("atualizado_em", { ascending: false });
      setRows((data ?? []) as unknown as Caso[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <PageHeader title="Histórico" description="Casos aprovados e relatórios finalizados." />
      <Table>
        <thead>
          <tr>
            <Th>ID</Th>
            <Th>Cliente</Th>
            <Th>Agente</Th>
            <Th>Aprovado em</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">Carregando...</td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhum caso aprovado ainda.</td></tr>
          ) : (
            rows.map((c) => (
              <tr key={c.id}>
                <Td className="font-mono text-xs">{c.codigo}</Td>
                <Td className="font-medium">{c.unidade?.matriz?.empresa?.nome ?? "—"}{c.unidade?.nome ? <span className="ml-1 text-xs text-muted-foreground">· {c.unidade.nome}</span> : null}</Td>
                <Td>{c.agente?.nome ?? "—"}</Td>
                <Td>{new Date(c.criado_em).toLocaleDateString("pt-BR")}</Td>
                <Td><Badge className={statusTones["aprovado"]}>{statusLabels["aprovado"]}</Badge></Td>
              </tr>
            ))
          )}
        </tbody>
      </Table>
    </div>
  );
}
