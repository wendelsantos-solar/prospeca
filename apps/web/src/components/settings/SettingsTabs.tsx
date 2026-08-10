import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { AppIcon } from "@/design-system/icons/AppIcon";
import { icons } from "@/design-system/icons/icon-registry";
import { User, SlidersHorizontal, Plug, CreditCard, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface TabItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const SETTINGS_TABS: TabItem[] = [
  { to: "/app/configuracoes/conta", label: "Conta", icon: User },
  { to: "/app/configuracoes/motor", label: "Prospecção", icon: SlidersHorizontal },
  { to: "/app/configuracoes/integracoes", label: "Integrações", icon: Plug },
  { to: "/app/configuracoes/plano", label: "Plano", icon: CreditCard },
  { to: "/app/configuracoes/dados", label: "Dados", icon: ShieldCheck },
];

export function SettingsTabs() {
  const currentPath = useRouterState({ select: (r) => r.location.pathname });

  return (
    <div className="no-scrollbar flex items-center gap-1 overflow-x-auto border-b border-border bg-surface px-5 py-2">
      {SETTINGS_TABS.map((tab) => {
        const active = currentPath === tab.to || currentPath.startsWith(`${tab.to}/`);
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded px-2.5 py-1.5 text-[12px] font-medium transition-colors",
              active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <AppIcon icon={tab.icon} size="xs" tone="inherit" decorative />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
