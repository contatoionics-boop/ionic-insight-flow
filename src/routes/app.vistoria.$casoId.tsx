import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";

import { AgentChat } from "@/components/agent/AgentChat";

export const Route = createFileRoute("/app/vistoria/$casoId")({
  component: VistoriaPage,
});

function VistoriaPage() {
  const { casoId } = Route.useParams();
  const navigate = useNavigate();
  return (
    <AgentChat
      casoId={casoId}
      onFinalized={() => {
        setTimeout(() => navigate({ to: "/app/minhas-vistorias" }), 1500);
      }}
    />
  );
}
