import type { MouseEvent } from "react";
import { Link, useLocation, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

declare module "@tanstack/history" {
  interface HistoryState {
    origemMapeamento?: "resultados" | "detalhe";
  }
}

export function cliqueNaMesmaAba(event: MouseEvent<HTMLAnchorElement>) {
  return event.button === 0 && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
}

export function VoltarMapeamento({ revisaoId }: { revisaoId?: string }) {
  const origem = useLocation({ select: (location) => location.state.origemMapeamento });
  const router = useRouter();

  function voltar(event: MouseEvent<HTMLAnchorElement>) {
    if (!origem || !cliqueNaMesmaAba(event) || !router.history.canGoBack()) return;
    event.preventDefault();
    router.history.back();
  }

  const className = "inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground";
  const seta = <ArrowLeft className="h-4 w-4" aria-hidden="true" />;

  if (revisaoId && origem === "detalhe") {
    return (
      <Link to="/app/vistorias/$id" params={{ id: revisaoId }} onClick={voltar} className={className}>
        {seta} Voltar para detalhes do mapeamento
      </Link>
    );
  }
  if (revisaoId && !origem) {
    return (
      <Link to="/app/review-queue" className={className}>
        {seta} Voltar para a fila de revisão
      </Link>
    );
  }
  return (
    <Link to="/app/cases" onClick={voltar} className={className}>
      {seta} Voltar para resultado de mapeamentos
    </Link>
  );
}
