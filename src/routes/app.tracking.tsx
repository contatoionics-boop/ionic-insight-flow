import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Table, Th, Td, Badge } from "@/components/ui-bits";
import { cases, statusLabels, statusTones } from "@/lib/mock-data";

export const Route = createFileRoute("/app/tracking")({
  component: TrackingPage,
});

function TrackingPage() {
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
          {cases.map((c) => (
            <tr key={c.id}>
              <Td className="font-mono text-xs">{c.id}</Td>
              <Td className="font-medium">{c.clientName}</Td>
              <Td>{c.agent}</Td>
              <Td><Badge className={statusTones[c.status]}>{statusLabels[c.status]}</Badge></Td>
              <Td>{new Date(c.date).toLocaleDateString("pt-BR")}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
