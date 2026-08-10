import { createFileRoute, Navigate, useSearch } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({
  section: z.string().optional(),
  integration: z.string().optional(),
  integration_message: z.string().optional(),
});

export const Route = createFileRoute("/app/configuracoes/")({
  validateSearch: searchSchema,
  component: SettingsIndex,
});

function SettingsIndex() {
  const search = useSearch({ from: "/app/configuracoes/" });

  // Mapeamento de URLs legadas (?section=...) para as novas sub-rotas
  if (search.section === "integracoes" || search.integration) {
    return (
      <Navigate
        to="/app/configuracoes/integracoes"
        search={{
          integration: search.integration,
          integration_message: search.integration_message,
        }}
        replace
      />
    );
  }
  if (
    search.section === "prospeccao" ||
    search.section === "mensagens" ||
    search.section === "score"
  ) {
    return <Navigate to="/app/configuracoes/motor" replace />;
  }
  if (search.section === "plano") {
    return <Navigate to="/app/configuracoes/plano" replace />;
  }
  if (search.section === "dados") {
    return <Navigate to="/app/configuracoes/dados" replace />;
  }

  // Padrão: vai para conta & organização
  return <Navigate to="/app/configuracoes/conta" replace />;
}
