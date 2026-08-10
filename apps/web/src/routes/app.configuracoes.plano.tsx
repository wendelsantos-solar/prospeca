import { createFileRoute } from "@tanstack/react-router";
import { SubscriptionSettings } from "@/components/settings/SubscriptionSettings";

export const Route = createFileRoute("/app/configuracoes/plano")({
  head: () => ({
    meta: [
      { title: "Plano & Faturamento — Prospeca" },
      { name: "description", content: "Gerencie sua assinatura e limites de prospecção." },
    ],
  }),
  component: SubscriptionSettingsRoute,
});

function SubscriptionSettingsRoute() {
  return <SubscriptionSettings />;
}
