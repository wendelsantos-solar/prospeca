// Deterministic, versioned lead score (v2.0.0, OSM-aware). MUST stay identical
// to packages/domain/src/score.ts — guarded by the vector tests in both dirs.
export const SCORE_RULE_VERSION = "v2.0.0";

export interface ScoreInput {
  hasWebsite: boolean;
  hasValidPhone: boolean;
  whatsappStatus: "unknown" | "possible" | "verified" | "invalid";
  hasEmail: boolean;
  hasInstagram: boolean;
  hasCategory: boolean;
  // Reserved for the Google provider / Phase 2 — NOT read by the v2.0.0 rule.
  rating: number | null;
  reviewCount: number | null;
  distanceMeters: number | null;
  businessStatus: string | null;
}

export interface ScoreBreakdown {
  ruleVersion: string;
  total: number;
  items: Array<{ key: string; label: string; points: number; reason: string }>;
}

export function calculateScore(input: ScoreInput): ScoreBreakdown {
  const items: ScoreBreakdown["items"] = [];
  const add = (key: string, label: string, points: number, reason: string) =>
    items.push({ key, label, points, reason });

  if (!input.hasWebsite) add("no_website", "Sem site", 35, "Sem presença digital — alta oportunidade");
  if (input.hasValidPhone) add("valid_phone", "Telefone válido", 20, "Contato direto possível");
  if (input.whatsappStatus === "possible" || input.whatsappStatus === "verified")
    add("whatsapp", "WhatsApp", 15, "Canal de contato rápido");
  if (input.distanceMeters != null && input.distanceMeters <= 5000)
    add("nearby_5", "Até 5 km", 10, "Muito próximo");
  else if (input.distanceMeters != null && input.distanceMeters <= 15000)
    add("nearby_15", "Até 15 km", 5, "Próximo");
  if (input.hasCategory) add("category", "Categoria identificada", 5, "Segmento conhecido");
  if (input.hasEmail) add("email", "E-mail comercial", 10, "Canal formal disponível");
  if (input.hasInstagram) add("instagram", "Instagram", 5, "Presença em rede social");

  const total = Math.max(
    0,
    Math.min(
      100,
      items.reduce((s, i) => s + i.points, 0),
    ),
  );
  return { ruleVersion: SCORE_RULE_VERSION, total, items };
}

export function temperatureFromScore(score: number): "hot" | "warm" | "cold" {
  if (score >= 75) return "hot";
  if (score >= 45) return "warm";
  return "cold";
}
