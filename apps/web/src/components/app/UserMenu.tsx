import { useState } from "react";
import { LogOut, Settings, Building2, Check, ChevronsUpDown, ChevronDown } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { getSupabase } from "@/lib/supabase";
import { isDemoMode } from "@/lib/env";
import {
  useTenant,
  setActiveOrganizationId,
  useRefreshTenant,
  type OrganizationMembership,
} from "@/lib/tenant";
import { cn } from "@/lib/utils";

interface UserMenuProps {
  className?: string;
  /** NavRail expandido: renderiza o label ao lado do avatar (Fase 2 UI). */
  expanded?: boolean;
}

/** Account avatar + dropdown: shows the signed-in e-mail, active workspace,
 * links to Configurações, and is the only place a user can sign out. */
export function UserMenu({ className, expanded }: UserMenuProps) {
  const { user } = useAuth();
  const { tenant, memberships, isLoading: tenantLoading } = useTenant();
  const refreshTenant = useRefreshTenant();
  const email = user?.email ?? null;
  const initial = email ? email[0]!.toUpperCase() : "?";
  const hasMultipleOrgs = memberships.length > 1;

  // Nome REAL do usuário (metadado do signup) — nunca inventado. Formato
  // "Mateus P." (primeiro nome + inicial do último), como o mockup.
  const fullName =
    typeof user?.user_metadata?.full_name === "string"
      ? (user.user_metadata.full_name as string).trim()
      : null;
  const displayName = (() => {
    if (fullName) {
      const parts = fullName.split(/\s+/).filter(Boolean);
      if (parts.length > 1) return `${parts[0]} ${parts[parts.length - 1]![0]!.toUpperCase()}.`;
      return parts[0] ?? null;
    }
    return email ? email.split("@")[0] : null;
  })();

  const handleSignOut = async () => {
    if (!isDemoMode) {
      await getSupabase().auth.signOut();
    }
    window.location.href = "/";
  };

  const handleSwitchOrg = (membership: OrganizationMembership) => {
    setActiveOrganizationId(membership.organizationId);
    refreshTenant();
    // Reload to pick up the new tenant context everywhere.
    window.location.reload();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-info-soft text-body-sm font-semibold text-info transition-colors hover:bg-info-soft/80",
          expanded &&
            "h-auto w-full rounded-lg bg-transparent p-0.5 text-left hover:bg-surface-hover",
          className,
        )}
        aria-label="Menu da conta"
      >
        {expanded ? (
          <span className="block w-full">
            {/* Workspace — dado REAL (tenant ativo), nunca inventado */}
            <span className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Workspace
                </span>
                <span className="block truncate text-[12px] font-medium text-foreground">
                  {tenant?.organizationName ?? "Carregando…"}
                </span>
              </span>
              <ChevronsUpDown className="h-3 w-3 shrink-0 text-muted-foreground" />
            </span>
            {/* Usuário logado */}
            <span className="mt-0.5 flex w-full items-center gap-2 border-t border-border/60 px-2 pt-1.5">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-info-soft text-[11px] font-semibold text-info">
                {initial}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium text-foreground">
                  {displayName ?? "Conta"}
                </span>
                <span className="block text-[10.5px] text-muted-foreground">Ver perfil</span>
              </span>
              <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
            </span>
          </span>
        ) : (
          initial
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {email && (
          <>
            <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
              {email}
            </DropdownMenuLabel>
            {tenant && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1">
                  <Building2 className="h-3 w-3" />
                  {tenant.organizationName}
                </span>
              </div>
            )}
            <DropdownMenuSeparator />
          </>
        )}

        {/* Workspace switcher — only shown when user has multiple orgs */}
        {hasMultipleOrgs && (
          <>
            <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Workspaces
            </DropdownMenuLabel>
            {memberships.map((m) => (
              <DropdownMenuItem
                key={m.organizationId}
                onSelect={() => handleSwitchOrg(m)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-sm">{m.organizationName}</span>
                {m.organizationId === tenant?.organizationId && (
                  <Check className="h-4 w-4 text-primary shrink-0" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuItem asChild>
          <Link to="/app/configuracoes" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configurações
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={handleSignOut}
          className="gap-2 text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
