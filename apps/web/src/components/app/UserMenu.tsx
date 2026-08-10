import { useState } from "react";
import { LogOut, Settings, Building2, Check, ChevronsUpDown } from "lucide-react";
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
}

/** Account avatar + dropdown: shows the signed-in e-mail, active workspace,
 * links to Configurações, and is the only place a user can sign out. */
export function UserMenu({ className }: UserMenuProps) {
  const { user } = useAuth();
  const { tenant, memberships, isLoading: tenantLoading } = useTenant();
  const refreshTenant = useRefreshTenant();
  const email = user?.email ?? null;
  const initial = email ? email[0]!.toUpperCase() : "?";
  const hasMultipleOrgs = memberships.length > 1;

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
          className,
        )}
        aria-label="Menu da conta"
      >
        {initial}
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
