import { getSupabase } from "./supabase";

export interface BillingPlan {
  code: string;
  name: string;
  description: string | null;
  monthlyPriceCents: number | null;
  annualPriceCents: number | null;
  features: Record<string, boolean>;
  limits: Record<string, number>;
  displayOrder: number;
}

export interface FounderOffer {
  isActive: boolean;
  seatsTotal: number | null;
  seatsClaimed: number;
  priceCents: number | null;
  endsAt: string | null;
}

// During the paid pilot we publish only plans whose complete journey is
// available today. Hidden catalog entries remain in the database for future
// migrations, but are not promises on the public pricing page.
const PUBLIC_PILOT_PLANS = ["free", "professional"];

// billing_plans has a public `select using (true)` RLS policy — this is the
// pricing catalog, not sensitive data.
export async function fetchBillingPlans(): Promise<BillingPlan[]> {
  const { data, error } = await getSupabase()
    .from("billing_plans")
    .select(
      "code, name, description, monthly_price_cents, annual_price_cents, features, limits, display_order",
    )
    .eq("is_active", true)
    .eq("is_public", true)
    .in("code", PUBLIC_PILOT_PLANS)
    .order("display_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    code: row.code,
    name: row.name,
    description: row.description,
    monthlyPriceCents: row.monthly_price_cents,
    annualPriceCents: row.annual_price_cents,
    features: (row.features as Record<string, boolean>) ?? {},
    limits: (row.limits as Record<string, number>) ?? {},
    displayOrder: row.display_order,
  }));
}

export async function fetchFounderOffer(): Promise<FounderOffer | null> {
  const { data, error } = await getSupabase()
    .from("founder_offer")
    .select("is_active, seats_total, seats_claimed, price_cents, ends_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    isActive: data.is_active,
    seatsTotal: data.seats_total,
    seatsClaimed: data.seats_claimed,
    priceCents: data.price_cents,
    endsAt: data.ends_at,
  };
}

export function formatPriceCents(cents: number | null): string {
  if (cents === null) return "Personalizado";
  if (cents === 0) return "R$ 0";
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
