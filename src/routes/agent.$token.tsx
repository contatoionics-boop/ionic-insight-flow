import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { ListChecks } from "lucide-react";

import { Button } from "@/components/ui-bits";
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

  if (modo === "chat") {
    return (
      <div>
        <div className="px-3 pt-3 sm:px-5">
          <Button
            variant="secondary"
            onClick={() => navigate({ to: "/agent/$token", params: { token }, search: {} })}
          >
            <ListChecks className="h-4 w-4" /> Voltar ao checklist
          </Button>
        </div>
        <AgentChat token={token} />
      </div>
    );
  }

  return (
    <ChecklistVistoria
      token={token}
      onTrocarModo={() =>
        navigate({ to: "/agent/$token", params: { token }, search: { modo: "chat" } })
      }
    />
  );
}
