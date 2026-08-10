import { createFileRoute } from "@tanstack/react-router";
import { MotorSettings } from "@/components/settings/MotorSettings";

export const Route = createFileRoute("/app/configuracoes/motor")({
  head: () => ({
    meta: [
      { title: "Motor Comercial & Prospecção — Prospeca" },
      {
        name: "description",
        content: "Parâmetros de busca, regras de score e mensagens padronizadas.",
      },
    ],
  }),
  component: MotorSettingsRoute,
});

function MotorSettingsRoute() {
  return <MotorSettings />;
}
