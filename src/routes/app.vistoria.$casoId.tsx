import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { ListChecks } from "lucide-react";

import { Button } from "@/components/ui-bits";
import { AgentChat } from "@/components/agent/AgentChat";
import { ChecklistVistoria } from "@/components/agent/checklist/ChecklistVistoria";

export const Route = createFileRoute("/app/vistoria/$casoId")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { modo?: "chat" | "checklist" } =>
    search.modo === "chat" ? { modo: "chat" } : {},
  component: VistoriaPage,
});

function VistoriaPage() {
  const { casoId } = Route.useParams();
  const { modo } = Route.useSearch();
  const navigate = useNavigate();

  const concluir = () => {
    setTimeout(() => navigate({ to: "/app/minhas-vistorias" }), 1500);
  };

  if (modo === "chat") {
    return (
      <div>
        <div className="px-3 pt-3 sm:px-5">
          <Button
            variant="secondary"
            onClick={() => navigate({ to: "/app/vistoria/$casoId", params: { casoId }, search: {} })}
          >
            <ListChecks className="h-4 w-4" /> Voltar ao checklist
          </Button>
        </div>
        <AgentChat casoId={casoId} onFinalized={concluir} />
      </div>
    );
  }

  return (
    <ChecklistVistoria
      casoId={casoId}
      onFinalized={concluir}
      onTrocarModo={() =>
        navigate({ to: "/app/vistoria/$casoId", params: { casoId }, search: { modo: "chat" } })
      }
    />
  );
}
