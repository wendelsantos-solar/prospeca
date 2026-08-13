// interpret-search-intent: transforms a natural-language "missão" into
// structured search filters + a resolved taxonomy category (spec #7–10).
//
// This is the deterministic fallback parser. An LLM path (schema-validated,
// never executing queries directly) can replace the parser later without
// changing this response contract.

import { z } from "npm:zod@3";
import { AppError, handleOptions, json, logEvent, newRequestId } from "../_shared/http.ts";
import { requireAuth } from "../_shared/auth.ts";
import { parseSearchIntent } from "@leads/domain/search-intent";
import { resolveTaxonomy } from "@leads/domain/taxonomy";
import { SEED_TAXONOMY } from "@leads/domain/taxonomy-data";

const InputSchema = z.object({
  mission: z.string().min(3).max(300),
});

Deno.serve(async (req) => {
  const opts = handleOptions(req);
  if (opts) return opts;
  const requestId = newRequestId();

  try {
    await requireAuth(req);
    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Missão inválida.");

    const intent = parseSearchIntent(parsed.data.mission);
    const taxonomy = resolveTaxonomy(intent.businessIntent, SEED_TAXONOMY);

    logEvent({ requestId, operation: "interpret-search-intent", status: "ok" });
    return json(
      {
        intent,
        taxonomy: taxonomy
          ? {
              id: taxonomy.id,
              name: taxonomy.name,
              slug: taxonomy.slug,
              placesTypes: taxonomy.placesTypes,
              cnaeCodes: taxonomy.cnaeCodes,
            }
          : null,
      },
      200,
      {},
      req,
    );
  } catch (err) {
    if (err instanceof AppError) return err.toResponse(requestId, req);
    return new AppError("INTERNAL_ERROR", "Erro interno.").toResponse(requestId, req);
  }
});
