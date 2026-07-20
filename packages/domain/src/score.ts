// Deterministic, versioned lead score. Consolidated from
// supabase/functions/_shared/score.ts.
export const SCORE_RULE_VERSION = "v1.0.0";

export interface ScoreInput {
  hasWebsite: boolean;
  hasValidPhone: boolean;
  whatsappStatus: "unknown" | "possible" | "verified" | "invalid";
  hasEmail: boolean;
  hasInstagram: boolean;
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

  if (!input.hasWebsite) add("no_website", "Sem website", 25, "Oportunidade de presença digital");
  if (input.hasValidPhone) add("valid_phone", "Telefone válido", 15, "Contato direto possível");
  if (input.whatsappStatus === "possible" || input.whatsappStatus === "verified")
    add("whatsapp", "WhatsApp possível/verificado", 10, "Canal de contato rápido");
  if (input.hasEmail) add("email", "E-mail comercial", 10, "Canal formal disponível");
  if (input.hasInstagram) add("instagram", "Instagram", 5, "Presença em rede social");
  if (input.rating != null && input.rating >= 4.0)
    add("rating", "Nota ≥ 4,0", 10, `Nota ${input.rating}`);
  if (input.reviewCount != null && input.reviewCount >= 20)
    add("reviews_20", "20+ avaliações", 10, `${input.reviewCount} avaliações`);
  if (input.reviewCount != null && input.reviewCount >= 100)
    add("reviews_100", "100+ avaliações", 5, "Alto volume de avaliações");
  if (input.distanceMeters != null && input.distanceMeters <= 10000)
    add("nearby", "Até 10 km", 5, "Proximidade facilita visita");
  if (input.businessStatus === "OPERATIONAL")
    add("operational", "Em operação", 5, "Estabelecimento ativo");

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
