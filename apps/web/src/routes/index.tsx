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
        title: "Prospeca — Encontre quem abordar primeiro e por quê",
      },
      {
        name: "description",
        content:
          "Pesquise empresas por nicho e região, entenda o score de oportunidade e organize o próximo contato com você no controle.",
      },
      { property: "og:title", content: "Prospeca — Saiba quem abordar primeiro" },
      {
        property: "og:description",
        content:
          "Encontre empresas locais, entenda por que são oportunidades e organize o próximo contato.",
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
