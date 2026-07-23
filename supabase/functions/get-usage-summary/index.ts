// get-usage-summary: uso + custo estimado + hit-rate da org do chamador no mês
// corrente. Só leitura; alimenta o painel de custo (Fase 1 — instrumentação).
import { AppError, handleOptions, json, logEvent, newRequestId } from "../_shared/http.ts";
import { requireAuth } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const opts = handleOptions(req);
  if (opts) return opts;
  const requestId = newRequestId();

  try {
    const ctx = await requireAuth(req);
    // org vem do auth (não do input) → seguro chamar via service role.
    const { data, error } = await ctx.adminClient.rpc("get_usage_summary", {
      p_organization_id: ctx.organizationId,
    });
    if (error) throw new AppError("INTERNAL_ERROR", "Falha ao carregar uso.");
    logEvent({ requestId, operation: "get-usage-summary", status: "ok" });
    return json(data ?? {});
  } catch (err) {
    if (err instanceof AppError) return err.toResponse(requestId);
    return new AppError("INTERNAL_ERROR", "Erro interno.").toResponse(requestId);
  }
});
