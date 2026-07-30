import { getSupabase } from "./supabase";

export interface AccountContext {
  userId: string;
  email: string | null;
  fullName: string;
  organizationId: string;
  organizationName: string;
  role: string;
}

/** Real account identity — distinct from `useSettingsStore`'s userName/
 * companyName, which are a local, per-browser "who's sending this message"
 * label (see lib/message-fill.ts), not the account itself. */
export async function fetchAccountContext(): Promise<AccountContext | null> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("organization_members")
      .select("role, organization_id, organizations(name)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
  ]);

  if (!membership) return null;
  const org = membership.organizations as unknown as { name: string } | null;

  return {
    userId: user.id,
    email: user.email ?? null,
    fullName: profile?.full_name ?? "",
    organizationId: membership.organization_id,
    organizationName: org?.name ?? "",
    role: membership.role,
  };
}

export async function updateFullName(fullName: string): Promise<void> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada.");
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", user.id);
  if (error) throw new Error(error.message);
}

export async function updateOrganizationName(organizationId: string, name: string): Promise<void> {
  const { error } = await getSupabase()
    .from("organizations")
    .update({ name })
    .eq("id", organizationId);
  if (error) throw new Error(error.message);
}

export interface CurrentSubscription {
  planCode: string;
  planName: string;
  status: string;
  limits: Record<string, number>;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export async function fetchCurrentSubscription(): Promise<CurrentSubscription | null> {
  const { data, error } = await getSupabase()
    .from("subscriptions")
    .select("status, current_period_end, cancel_at_period_end, billing_plans(code, name, limits)")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const plan = data.billing_plans as unknown as {
    code: string;
    name: string;
    limits: Record<string, number>;
  } | null;
  if (!plan) return null;
  return {
    planCode: plan.code,
    planName: plan.name,
    status: data.status,
    limits: plan.limits ?? {},
    currentPeriodEnd: data.current_period_end,
    cancelAtPeriodEnd: data.cancel_at_period_end,
  };
}
