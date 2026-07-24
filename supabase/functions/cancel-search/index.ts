// cancel-search: marks an in-flight search as cancelled.
import { AppError, handleOptions, json, newRequestId } from "../_shared/http.ts";
import { requireAuth } from "../_shared/auth.ts";
import { writeAudit } from "../_shared/quota.ts";

Deno.serve(async (req) => {
  const opts = handleOptions(req);
  if (opts) return opts;
  const requestId = newRequestId();

  try {
    const ctx = await requireAuth(req);
    const { searchId } = await req.json();
    if (!searchId) throw new AppError("VALIDATION_ERROR", "searchId obrigatório.");

    const { data: search, error } = await ctx.userClient
      .from("searches")
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("id", searchId)
      .in("status", ["queued", "geocoding", "searching", "importing", "enriching"])
      .select("id, status")
      .maybeSingle();
    if (error) throw new AppError("INTERNAL_ERROR", "Falha ao cancelar.");
    if (!search) throw new AppError("SEARCH_NOT_FOUND", "Busca não encontrada ou já finalizada.");

    await writeAudit(ctx.adminClient, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "search.cancelled",
      entityType: "search",
      entityId: searchId,
    });
    return json(search, 200, {}, req);
  } catch (err) {
    if (err instanceof AppError) return err.toResponse(requestId, req);
    return new AppError("INTERNAL_ERROR", "Erro interno.").toResponse(requestId, req);
  }
});
