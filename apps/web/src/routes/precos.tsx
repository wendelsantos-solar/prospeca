import { createFileRoute } from "@tanstack/react-router";
import { PricingPage } from "@/components/marketing/PricingPage";

export const Route = createFileRoute("/precos")({
  head: () => ({
    meta: [
      { title: "Preços — Prospeca" },
      {
        name: "description",
        content:
          "Planos da Prospeca: comece de graça e faça upgrade quando fizer sentido. Sem cartão de crédito no plano gratuito.",
      },
      { property: "og:title", content: "Preços — Prospeca" },
      {
        property: "og:description",
        content:
          "Comece de graça e faça upgrade quando fizer sentido. Sem cartão no plano gratuito.",
      },
    ],
    links: [{ rel: "canonical", href: "/precos" }],
  }),
  component: PricingPage,
});
