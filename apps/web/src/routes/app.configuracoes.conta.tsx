import { createFileRoute } from "@tanstack/react-router";
import { AccountSettings } from "@/components/settings/AccountSettings";

export const Route = createFileRoute("/app/configuracoes/conta")({
  head: () => ({
    meta: [
      { title: "Conta & Organização — Prospeca" },
      { name: "description", content: "Gerencie perfil, organização e aparência no Prospeca." },
    ],
  }),
  component: AccountSettingsRoute,
});

function AccountSettingsRoute() {
  return <AccountSettings />;
}
