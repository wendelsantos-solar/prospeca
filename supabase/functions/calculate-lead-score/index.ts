// calculate-lead-score: copia o V2 (opportunity-score) persistido para
// leads.score — Fase 3, unificação de score. O v3 (score.ts) ficou LEGADO:
// não é mais calculado aqui; leads sem V2 permanecem com o número legado
// marcado 'legacy-v3.0.0' (nunca 0) e convergem quando o job
// OPPORTUNITY_SCORING rodar (score-company sincroniza leads).
import { z } from "npm:zod@3";
import { AppError, handleOptions, json, logEvent, newRequestId } from "../_shared/http.ts";
import { requireAuth } from "../_shared/auth.ts";
import { OPPORTUNITY_SCORE_VERSION } from "@leads/domain/opportunity-score";

/**
 * Versões cujo `leads.score` ainda carrega o número da engine LEGADA (v3.0.0).
 * `null` cobre linhas antigas anteriores à coluna de versão.
 */
const LEGACY_SCORE_RULE_VERSIONS = ["v3.0.0", "legacy-v3.0.0"];

function carriesLegacyScore(ruleVersion: string | null): boolean {
  return ruleVersion === null || LEGACY_SCORE_RULE_VERSIONS.includes(ruleVersion);
}

const InputSchema = z.object({ leadIds: z.array(z.string().uuid()).min(1).max(100) });

Deno.serve(async (req) => {
  const opts = handleOptions(req);
  if (opts) return opts;
  const requestId = newRequestId();

  try {
    const ctx = await requireAuth(req);
    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Entrada inválida.");

    const { data: leads } = await ctx.userClient
      .from("leads")
      .select("id, organization_id, place_id, score, score_rule_version")
      .in("id", parsed.data.leadIds);

    let updated = 0;
    let legacyCount = 0;
    for (const lead of leads ?? []) {
      const leadId = lead.id as string;
      // V2 MAIS RECENTE para (org, place) — o lead herda exatamente o que a
      // descoberta mostra (mesma linha de company_opportunity_scores).
      const { data: v2 } = await ctx.userClient
        .from("company_opportunity_scores")
        .select("score, temperature, rule_version, breakdown")
        .eq("organization_id", lead.organization_id)
        .eq("place_id", lead.place_id)
        .order("calculated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (v2 && v2.rule_version === OPPORTUNITY_SCORE_VERSION && v2.score != null) {
        await ctx.userClient
          .from("leads")
          .update({
            score: v2.score,
            score_breakdown: v2.breakdown,
            score_rule_version: v2.rule_version,
            temperature: v2.temperature ?? "cold",
            // Preserva o v3 legado para rollback. SPREAD CONDICIONAL, não ternário
            // com null: a chave só entra no update quando há um v3 real a guardar.
            // Escrever null aqui apagaria o valor já preservado assim que o lead
            // passasse a V2 (score-company sincroniza antes) — a garantia de
            // rollback sumiria em silêncio.
            //
            // A condição olha SE O NÚMERO ATUAL É O LEGADO, não se a versão
            // difere da corrente. Comparar com a versão corrente parecia
            // equivalente enquanto a engine ficou em v1.2.0, mas quebra no
            // primeiro bump: um lead em v1.2.0 recalculado sob v1.3.0 passaria
            // no teste e gravaria o score V2 ANTERIOR por cima do v3 original,
            // destruindo em silêncio o rollback que a migration
            // 20260817000019 promete.
            ...(carriesLegacyScore(lead.score_rule_version as string | null) && lead.score != null
              ? { score_legacy_v3: lead.score }
              : {}),
          })
          .eq("id", leadId);
        updated++;
      } else {
        // Sem V2 ainda: o número legado permanece; só marca a versão.
        await ctx.userClient
          .from("leads")
          .update({ score_rule_version: "legacy-v3.0.0" })
          .eq("id", leadId)
          .eq("score_rule_version", "v3.0.0");
        legacyCount++;
      }
    }

    logEvent({
      requestId,
      operation: "calculate-lead-score",
      status: "ok",
      resultCount: updated,
    });
    return json({ updated, legacyCount, ruleVersion: OPPORTUNITY_SCORE_VERSION }, 200, {}, req);
  } catch (err) {
    if (err instanceof AppError) return err.toResponse(requestId, req);
    return new AppError("INTERNAL_ERROR", "Erro interno.").toResponse(requestId, req);
  }
});
