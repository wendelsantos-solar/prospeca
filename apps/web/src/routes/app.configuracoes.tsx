import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SettingsTabs } from "@/components/settings/SettingsTabs";
import { AppIcon } from "@/design-system/icons/AppIcon";
import { icons } from "@/design-system/icons/icon-registry";

export const Route = createFileRoute("/app/configuracoes")({
  component: SettingsLayout,
});

function SettingsLayout() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header — mesmo padrão de app.hoje.tsx */}
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-5 py-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary-soft text-primary">
          <AppIcon icon={icons.navigation.settings} size="md" tone="primary" decorative />
        </div>
        <div>
          <h1 className="text-[16px] font-semibold">Configurações</h1>
          <p className="text-[11.5px] text-muted-foreground">
            Preferências da sua conta e organização
          </p>
        </div>
      </header>

      {/* Abas — mesmo padrão de sub-navegação de Hoje/Agenda */}
      <SettingsTabs />

      {/* Conteúdo rolável */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-surface-2 px-5 py-4">
        <div className="mx-auto max-w-3xl">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
