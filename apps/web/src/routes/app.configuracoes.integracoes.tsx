import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { IntegrationsSettings } from "@/components/settings/IntegrationsSettings";

const searchSchema = z.object({
  integration: z.string().optional(),
  integration_message: z.string().optional(),
});

export const Route = createFileRoute("/app/configuracoes/integracoes")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Integrações — Prospeca" },
      {
        name: "description",
        content: "Conecte Google Calendar, automações e webhooks ao Prospeca.",
      },
    ],
  }),
  component: IntegrationsSettingsRoute,
});

function IntegrationsSettingsRoute() {
  return <IntegrationsSettings />;
}
