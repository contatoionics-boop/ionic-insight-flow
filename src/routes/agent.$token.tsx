import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { AgentChat } from "@/components/agent/AgentChat";
import { ChecklistVistoria } from "@/components/agent/checklist/ChecklistVistoria";

export const Route = createFileRoute("/agent/$token")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { modo?: "chat" | "checklist" } =>
    search.modo === "chat" ? { modo: "chat" } : {},
  component: AgentPage,
});

function AgentPage() {
  const { token } = Route.useParams();
  const { modo } = Route.useSearch();
  const navigate = useNavigate();

  if (modo === "chat") return <AgentChat token={token} />;

  return (
    <ChecklistVistoria
      token={token}
      onTrocarModo={() =>
        navigate({ to: "/agent/$token", params: { token }, search: { modo: "chat" } })
      }
    />
  );
}
