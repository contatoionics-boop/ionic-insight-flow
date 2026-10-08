import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { BicoLoading } from "@/components/ui/bico-loading";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Carregamento entre telas: só aparece se a página demorar mais de 250 ms.
    defaultPendingComponent: () => <BicoLoading tela />,
    defaultPendingMs: 250,
    defaultPendingMinMs: 400,
  });

  return router;
};
