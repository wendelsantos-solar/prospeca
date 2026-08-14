// get-search-status: polling endpoint for real search progress.
import { AppError, handleOptions, json, newRequestId } from "../_shared/http.ts";
import { requireAuth } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const opts = handleOptions(req);
  if (opts) return opts;
  const requestId = newRequestId();

  try {
    const ctx = await requireAuth(req);
    const { searchId } = await req.json();
    if (!searchId) throw new AppError("VALIDATION_ERROR", "searchId obrigatório.");

    const { data: search } = await ctx.userClient
      .from("searches")
      .select(
        "id, status, found_count, imported_count, enriched_count, provider_request_count, estimated_cost, estimated_results, error_message, started_at, completed_at",
      )
      .eq("id", searchId)
      .maybeSingle();
    if (!search) throw new AppError("SEARCH_NOT_FOUND", "Busca não encontrada.");

    return json(search, 200, {}, req);
  } catch (err) {
    if (err instanceof AppError) return err.toResponse(requestId, req);
    return new AppError("INTERNAL_ERROR", "Erro interno.").toResponse(requestId, req);
  }
});
