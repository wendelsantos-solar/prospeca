import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

const LandingPage = lazy(() =>
  import("@/components/marketing/LandingPage").then((m) => ({ default: m.LandingPage })),
);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "Prospeca — Encontre negócios locais com alto potencial",
      },
      {
        name: "description",
        content:
          "Pesquise negócios locais por nicho e região, priorize oportunidades com sinais comerciais reais e organize cada contato até o fechamento.",
      },
      { property: "og:title", content: "Prospeca — Prospecção local com prioridade real" },
      {
        property: "og:description",
        content: "Encontre, priorize e acompanhe negócios locais em um único fluxo.",
      },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: IndexRoute,
});

// Logged-in visitors (or demo mode, which is always "authenticated") skip the
// landing and go straight to the app — same destination `/` always redirected
// to before. Only actually-anonymous visitors now see the marketing page.
function IndexRoute() {
  const { loading, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && isAuthenticated) navigate({ to: "/app/mapa" });
  }, [loading, isAuthenticated, navigate]);

  if (loading || isAuthenticated) return null;
  return (
    <Suspense fallback={null}>
      <LandingPage />
    </Suspense>
  );
}
