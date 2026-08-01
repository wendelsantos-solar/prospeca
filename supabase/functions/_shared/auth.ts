import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { AppError } from "./http.ts";

export interface AuthContext {
  userId: string;
  organizationId: string;
  role: string;
  /** Client bound to the caller's JWT — RLS enforced. */
  userClient: SupabaseClient;
  /** Service-role client — bypasses RLS. Server-side only. */
  adminClient: SupabaseClient;
}

export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
}

/**
 * Resolves the authenticated user and their organization membership.
 * Rejects unauthenticated calls and non-members.
 */
export async function requireAuth(req: Request, organizationId?: string): Promise<AuthContext> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new AppError("UNAUTHORIZED", "Autenticação necessária.");

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );

  const { data: userData, error } = await userClient.auth.getUser();
  if (error || !userData.user) throw new AppError("UNAUTHORIZED", "Sessão inválida ou expirada.");

  const admin = adminClient();
  let membershipQuery = admin
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userData.user.id);
  if (organizationId) membershipQuery = membershipQuery.eq("organization_id", organizationId);

  // Deterministic order is required: without it, Postgres returns whichever
  // row it likes for users with 2+ memberships (the common case — every
  // invited/pilot user also has an auto-created Free org), so `.limit(1)`
  // below would silently target an arbitrary organization on every call that
  // doesn't pass an explicit organizationId. Same fix as apps/web/src/lib/tenant.ts.
  const { data: memberships } = await membershipQuery
    .order("created_at", { ascending: true })
    .order("organization_id", { ascending: true })
    .limit(1);
  const membership = memberships?.[0];
  if (!membership) throw new AppError("FORBIDDEN", "Usuário não pertence a esta organização.");

  return {
    userId: userData.user.id,
    organizationId: membership.organization_id,
    role: membership.role,
    userClient,
    adminClient: admin,
  };
}
