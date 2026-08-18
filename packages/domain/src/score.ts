// Deterministic, versioned lead score. Consolidated from
// supabase/functions/_shared/score.ts.
//
// ⚠️ LEGADO / DEPRECATED (Fase 3 — unificação de score). A engine CANÔNICA é
// opportunity-score.ts (V2, v1.2.0): multi-componente, confidence, scoreState
// e inputs por organização. leads.score agora carrega o V2 (cópia
// materializada sincronizada por score-company; migration
// 20260817000019_unify_leads_score_v2).
//
// Este módulo NÃO é deletado ainda por dois motivos:
//  1. ROLLBACK: leads.score_legacy_v3 guarda o v3 antigo e o procedimento de
//     reversão documentado na migration restaura exatamente estes números —
//     a fórmula precisa continuar disponível e idêntica;
//  2. LEITURA HISTÓRICA: score_breakdown antigo de leads legados usa esta
//     versão/forma (ruleVersion 'v3.0.0' / 'legacy-v3.0.0').
//
// NÃO use calculateScore para gravar scores novos. Deleção é outra tarefa.
//
// v3.0.0 (Google-only): opportunity-oriented. Score alto = negócio de BAIXA
// maturidade digital e alcançável — o lead que mais precisa do serviço. Usa os
// sinais que o Google sempre traz (rating, userRatingCount, businessStatus)
// além de site/telefone/whatsapp. Determinístico e versionado: mudar a fórmula
// muda a ORDEM dos leads, então bumpe a versão a cada ajuste.
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
