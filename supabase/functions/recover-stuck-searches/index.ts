// recover-stuck-searches: sweeper (backstop). Re-dispara execute-search para
// buscas presas em 'queued'/'searching' além de um limite — cobre trigger
// perdido ou run que morreu no meio. Service-role interno, como execute-search.
// Idempotente: execute-search só reprocessa buscas ainda em queued/searching.
// Recovery NUNCA repassa forceRefresh (não pode re-pagar um bypass velho).
import { AppError, handleOptions, json, logEvent, newRequestId } from "../_shared/http.ts";
import { adminClient } from "../_shared/auth.ts";
import { isInternalCall } from "../_shared/internal-auth.ts";

// 'queued' presa por >2min = trigger perdido. 'searching' >5min = run morto
// (mais folga p/ não colidir com uma busca lenta ainda em andamento).
const QUEUED_STUCK_MS = 2 * 60_000;
const SEARCHING_STUCK_MS = 5 * 60_000;
const MAX_PER_RUN = 25;

Deno.serve(async (req) => {
  const opts = handleOptions(req);
  if (opts) return opts;
  const requestId = newRequestId();

  if (!(await isInternalCall(req))) {
    return new AppError("FORBIDDEN", "Função interna.").toResponse(requestId, req);
  }

  const admin = adminClient();
  const queuedCutoff = new Date(Date.now() - QUEUED_STUCK_MS).toISOString();
  const searchingCutoff = new Date(Date.now() - SEARCHING_STUCK_MS).toISOString();

  // queued presas por created_at; searching presas por started_at (quando iniciou).
  const { data: stuck } = await admin
    .from("searches")
    .select("id, status")
    .or(
      `and(status.eq.queued,created_at.lt.${queuedCutoff}),` +
        `and(status.eq.searching,started_at.lt.${searchingCutoff})`,
    )
    .limit(MAX_PER_RUN);

  let redispatched = 0;
  for (const s of stuck ?? []) {
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/execute-search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        // Sem forceRefresh: recovery jamais re-paga um bypass.
        body: JSON.stringify({ searchId: s.id }),
      });
      redispatched++;
    } catch {
      // próxima passada do cron tenta de novo
    }
  }

  logEvent({
    requestId,
    operation: "recover-stuck-searches",
    status: "ok",
    resultCount: redispatched,
  });
  return json({ scanned: stuck?.length ?? 0, redispatched }, 200, {}, req);
});
