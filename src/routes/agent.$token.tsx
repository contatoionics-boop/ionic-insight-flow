import { createFileRoute } from "@tanstack/react-router";

import { AgentChat } from "@/components/agent/AgentChat";

export const Route = createFileRoute("/agent/$token")({
  component: AgentPage,
});

function AgentPage() {
  const { token } = Route.useParams();
  return <AgentChat token={token} />;
}
