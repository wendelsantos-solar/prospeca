// enrich-lead: async lead enrichment. Extracts contact signals from each lead's
// OWN website (SSRF-guarded, timed out). Writes lead_enrichments with provider,
// source_url, confidence, verification and collected_at. Explicit not_found —
// never fabricates data. Idempotent per (lead_id, provider, field).
//
// NOT runtime-verified in this checkout (no Deno/Supabase CLI here). Uses the
// same _shared helpers + SSRF guard mirrored from packages/providers.
import { z } from "npm:zod@3";
import { AppError, handleOptions, json, logEvent, newRequestId } from "../_shared/http.ts";
import { requireAuth } from "../_shared/auth.ts";
import { assertRateLimit } from "../_shared/quota.ts";
import { enrichFromWebsite } from "../_shared/enrich.ts";

const InputSchema = z.union([
  z.object({ leadId: z.string().uuid() }),
  z.object({ leadIds: z.array(z.string().uuid()).min(1).max(50) }),
]);

const PROVIDER = "website_scraper";
const CONCURRENCY = 5;
// Fill these lead columns from enrichment ONLY when currently empty (additive).
const FILLABLE: Record<string, string> = {
  email: "email",
  instagram: "instagram",
  whatsapp: "whatsapp",
};

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const chunk = items.slice(i, i + limit);
    out.push(...(await Promise.all(chunk.map(fn))));
  }
  return out;
}

Deno.serve(async (req) => {
  const opts = handleOptions(req);
  if (opts) return opts;
  const requestId = newRequestId();

  try {
    const ctx = await requireAuth(req);
    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Entrada inválida.");

    const ids = "leadId" in parsed.data ? [parsed.data.leadId] : parsed.data.leadIds;
    await assertRateLimit(ctx.adminClient, ctx.organizationId, "enrich_request", 20);

    const results = await mapWithConcurrency(ids, CONCURRENCY, async (leadId) => {
      const { data: lead } = await ctx.adminClient
        .from("leads")
        .select("id, organization_id, website, email, instagram, whatsapp")
        .eq("id", leadId)
        .eq("organization_id", ctx.organizationId)
        .maybeSingle();
      if (!lead) {
        return { leadId, found: 0, status: "lead_not_found" as const };
      }

      const { fields, status } = await enrichFromWebsite({ website: lead.website });

      // Idempotent: replace this provider's rows for the lead.
      await ctx.adminClient
        .from("lead_enrichments")
        .delete()
        .eq("lead_id", leadId)
        .eq("provider", PROVIDER);

      if (fields.length) {
        await ctx.adminClient.from("lead_enrichments").insert(
          fields.map((f) => ({
            organization_id: ctx.organizationId,
            lead_id: leadId,
            field: f.field,
            value: f.value,
            confidence: f.confidence,
            verification: f.verification,
            provider: f.provider,
            source_url: f.sourceUrl,
          })),
        );

        // Fill only empty lead columns — never overwrite existing data.
        const patch: Record<string, string> = {};
        for (const f of fields) {
          const col = FILLABLE[f.field];
          if (col && !lead[col as keyof typeof lead]) patch[col] = f.value;
        }
        if (Object.keys(patch).length) {
          await ctx.adminClient.from("leads").update(patch).eq("id", leadId);
        }
      }

      return { leadId, found: fields.length, status };
    });

    logEvent({
      requestId,
      organizationId: ctx.organizationId,
      operation: "enrich-lead",
      status: "ok",
      resultCount: results.length,
    });
    return json({ results }, 200, {}, req);
  } catch (err) {
    if (err instanceof AppError) return err.toResponse(requestId, req);
    logEvent({ requestId, operation: "enrich-lead", status: "error" });
    return new AppError("INTERNAL_ERROR", "Erro interno.").toResponse(requestId, req);
  }
});
