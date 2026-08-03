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
        title: "Prospeca — Encontre empresas que precisam do serviço que você vende",
      },
      {
        name: "description",
        content:
          "Pesquise empresas locais por nicho e região, identifique oportunidades com baixa presença digital e organize sua prospecção do início à venda.",
      },
      { property: "og:title", content: "Prospeca — Inteligência comercial local" },
      {
        property: "og:description",
        content: "Transforme negócios locais em oportunidades reais de venda.",
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
