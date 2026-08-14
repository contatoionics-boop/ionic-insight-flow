import { createFileRoute, useNavigate } from "@tanstack/react-router";

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
      <AgentChat
        casoId={casoId}
        onFinalized={concluir}
      />
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
