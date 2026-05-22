import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Table, Th, Td, Badge } from "@/components/ui-bits";
import { cases, statusTones, statusLabels } from "@/lib/mock-data";

export const Route = createFileRoute("/app/history")({
  component: HistoryPage,
});

function HistoryPage() {
  const approved = cases.filter((c) => c.status === "aprovado");
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
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {approved.map((c) => (
            <tr key={c.id}>
              <Td className="font-mono text-xs">{c.id}</Td>
              <Td className="font-medium">{c.clientName}</Td>
              <Td>{c.agent}</Td>
              <Td>{new Date(c.date).toLocaleDateString("pt-BR")}</Td>
              <Td><Badge className={statusTones[c.status]}>{statusLabels[c.status]}</Badge></Td>
              <Td>
                <a href="#" className="text-xs font-medium text-primary hover:underline">
                  Ver relatório
                </a>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
