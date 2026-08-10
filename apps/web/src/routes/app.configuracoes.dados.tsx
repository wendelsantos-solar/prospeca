import { createFileRoute } from "@tanstack/react-router";
import { SecurityDataSettings } from "@/components/settings/SecurityDataSettings";

export const Route = createFileRoute("/app/configuracoes/dados")({
  head: () => ({
    meta: [
      { title: "Segurança & Dados — Prospeca" },
      { name: "description", content: "Backups, exportações de dados e exclusão de conta." },
    ],
  }),
  component: SecurityDataSettingsRoute,
});

function SecurityDataSettingsRoute() {
  return <SecurityDataSettings />;
}
