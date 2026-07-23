// Deterministic, versioned lead score (v3.0.0, Google-only). MUST stay identical
// to packages/domain/src/score.ts — guarded by the vector tests in both dirs.
//
// v3.0.0: opportunity-oriented. Score alto = negócio de BAIXA maturidade digital
// e alcançável — o lead que mais precisa do serviço. Usa rating/userRatingCount/
// businessStatus (sempre presentes no Google) além de site/telefone/whatsapp.
export const SCORE_RULE_VERSION = "v3.0.0";

export interface ScoreInput {
  hasWebsite: boolean;
  hasValidPhone: boolean;
  whatsappStatus: "unknown" | "possible" | "verified" | "invalid";
  hasEmail: boolean;
  hasInstagram: boolean;
  hasCategory: boolean;
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

  // Guarda: negócio não-operacional (fechado temporária/permanentemente) não é
  // lead — zera o score. businessStatus nulo (dado ausente) NÃO aciona a guarda.
  if (input.businessStatus != null && input.businessStatus !== "OPERATIONAL") {
    add("not_operational", "Não operacional", 0, `Status ${input.businessStatus} — fora do funil`);
    return { ruleVersion: SCORE_RULE_VERSION, total: 0, items };
  }

  // ── Oportunidade: baixa maturidade digital = precisa do serviço ──
  if (!input.hasWebsite)
    add("no_website", "Sem site", 30, "Sem presença digital — alta oportunidade");
  if (input.rating != null && input.rating < 3.5)
    add("weak_reputation", "Reputação fraca", 15, "Nota baixa — oportunidade de melhoria");
  if (input.reviewCount != null && input.reviewCount < 20)
    add("low_traction", "Pouca tração", 10, "Poucas avaliações — baixa presença online");

  // ── Contato ──
  if (input.hasValidPhone) add("valid_phone", "Telefone válido", 20, "Contato direto possível");
  if (input.whatsappStatus === "possible" || input.whatsappStatus === "verified")
    add("whatsapp", "WhatsApp", 12, "Canal de contato rápido");
  if (input.hasEmail) add("email", "E-mail comercial", 8, "Canal formal disponível");
  if (input.hasInstagram) add("instagram", "Instagram", 5, "Presença em rede social");

  // ── Proximidade ──
  if (input.distanceMeters != null && input.distanceMeters <= 5000)
    add("nearby_5", "Até 5 km", 8, "Muito próximo");
  else if (input.distanceMeters != null && input.distanceMeters <= 15000)
    add("nearby_15", "Até 15 km", 4, "Próximo");

  // ── Contexto ──
  if (input.hasCategory) add("category", "Categoria identificada", 3, "Segmento conhecido");

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
