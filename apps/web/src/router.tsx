import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000, // 5min — Realtime subscriptions mantêm dados frescos sem polling
        gcTime: 15 * 60_000, // mantém cache 15min após o último uso
        refetchOnWindowFocus: false, // CRM não precisa refetch a cada foco de janela
        retry: 2,
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
