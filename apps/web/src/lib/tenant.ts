// Tenant context — centralized organization resolution for the frontend.
// Never trust organizationId from the client; always resolve from the database
// via the authenticated user's membership.

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "./supabase";
import { isDemoMode } from "./env";

export type OrganizationRole = "owner" | "admin" | "member";

export interface TenantContext {
  userId: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: OrganizationRole;
  plan: string;
  /** Whether the user belongs to multiple organizations (needs workspace switcher) */
  hasMultipleOrgs: boolean;
}

export interface OrganizationMembership {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: OrganizationRole;
  plan: string;
}

const DEMO_TENANT: TenantContext = {
  userId: "demo-user",
  organizationId: "demo-org",
  organizationName: "Minha organização",
  organizationSlug: "minha-organizacao",
  role: "owner",
  plan: "free",
  hasMultipleOrgs: false,
};

/**
 * Fetch all organizations the current user belongs to.
 */
async function fetchMemberships(): Promise<OrganizationMembership[]> {
  const supabase = getSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("organization_members")
    .select(
      `
      organization_id,
      role,
      organizations (
        id,
        name,
        slug,
        plan
      )
    `,
    )
    .eq("user_id", user.user.id);

  if (error) throw new Error(error.message);

  return (data ?? []).map((m: Record<string, unknown>) => {
    const org = m.organizations as Record<string, unknown>;
    return {
      organizationId: org?.id as string,
      organizationName: org?.name as string,
      organizationSlug: org?.slug as string,
      role: m.role as OrganizationRole,
      plan: org?.plan as string,
    };
  });
}

const TENANT_QUERY_KEY = ["tenant-context"] as const;

/**
 * Hook that resolves the current tenant context.
 * Returns the first (or only) organization membership for now.
 * In the future, this will support workspace switching.
 */
export function useTenant(): {
  tenant: TenantContext | null;
  memberships: OrganizationMembership[];
  isLoading: boolean;
  error: Error | null;
} {
  const isDemo = isDemoMode;

  const { data, isLoading, error } = useQuery({
    queryKey: TENANT_QUERY_KEY,
    queryFn: fetchMemberships,
    staleTime: 5 * 60_000, // 5 min
    retry: false,
    enabled: !isDemo,
  });

  // Demo mode: return static context
  if (isDemo) {
    return {
      tenant: DEMO_TENANT,
      memberships: [
        {
          organizationId: DEMO_TENANT.organizationId,
          organizationName: DEMO_TENANT.organizationName,
          organizationSlug: DEMO_TENANT.organizationSlug,
          role: DEMO_TENANT.role,
          plan: DEMO_TENANT.plan,
        },
      ],
      isLoading: false,
      error: null,
    };
  }

  const memberships = data ?? [];
  const first = memberships[0];

  if (!first && !isLoading) {
    return {
      tenant: null,
      memberships: [],
      isLoading: false,
      error: new Error("Nenhuma organização encontrada."),
    };
  }

  return {
    tenant: first
      ? {
          userId: "", // resolved server-side
          organizationId: first.organizationId,
          organizationName: first.organizationName,
          organizationSlug: first.organizationSlug,
          role: first.role,
          plan: first.plan,
          hasMultipleOrgs: memberships.length > 1,
        }
      : null,
    memberships,
    isLoading,
    error: error as Error | null,
  };
}

/**
 * Refresh tenant context (e.g., after accepting an invitation).
 */
export function useRefreshTenant() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: TENANT_QUERY_KEY });
}

/**
 * Helper to check if the current user can perform an action.
 * Use this for UI-level gating (real authorization is always server-side).
 */
export function canPerformAction(
  role: OrganizationRole,
  action: "write" | "admin" | "manage_members",
): boolean {
  switch (action) {
    case "write":
      return role === "owner" || role === "admin" || role === "member";
    case "admin":
      return role === "owner" || role === "admin";
    case "manage_members":
      return role === "owner" || role === "admin";
    default:
      return false;
  }
}
