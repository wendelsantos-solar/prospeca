import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000, // dados considerados frescos por 30s → evita refetch em cada mount
        gcTime: 5 * 60_000, // mantém cache 5min após o último uso
        refetchOnWindowFocus: false, // CRM não precisa refetch a cada foco de janela
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent", // prefetch de código+dados no hover/toque → navegação instantânea
    defaultPreloadStaleTime: 10_000, // reaproveita o dado pré-carregado por 10s
  });

  return router;
};
