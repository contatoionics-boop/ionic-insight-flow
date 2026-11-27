import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { CarregandoConteudo } from "@/components/ui/carregando-conteudo";
import { marcarInicioDaNavegacao } from "@/hooks/use-tempo-de-conteudo";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Carregamento entre telas: só aparece se a página demorar mais de 250 ms.
    defaultPendingComponent: () => <CarregandoConteudo texto="Carregando página…" className="justify-center p-8" />,
    defaultPendingMs: 250,
    defaultPendingMinMs: 0,
  });

  if (import.meta.env.DEV && typeof window !== "undefined") {
    router.subscribe("onBeforeNavigate", ({ pathChanged, toLocation }) => {
      if (pathChanged) marcarInicioDaNavegacao(toLocation.pathname);
    });
  }

  return router;
};
