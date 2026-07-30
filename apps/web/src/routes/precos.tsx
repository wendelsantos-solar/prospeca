import { createFileRoute } from "@tanstack/react-router";
import { PricingPage } from "@/components/marketing/PricingPage";

export const Route = createFileRoute("/precos")({
  head: () => ({
    meta: [
      { title: "Preços — Radar Local" },
      {
        name: "description",
        content:
          "Planos do Radar Local: comece de graça e faça upgrade quando fizer sentido. Sem cartão de crédito no plano gratuito.",
      },
      { property: "og:title", content: "Preços — Radar Local" },
    ],
    links: [{ rel: "canonical", href: "/precos" }],
  }),
  component: PricingPage,
});
