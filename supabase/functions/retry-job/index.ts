// retry-job: requeue a failed enrichment job and re-run it for its place.
// Platform-admin only (is_platform_admin). The reset uses the service role
// (cross-tenant visibility); the re-execution runs with the CALLER's JWT so it
// goes through the same tenant checks as the original run. Cross-org jobs that
// the admin does not belong to are requeued but re-invocation is skipped.
import { z } from "npm:zod@3";
import { AppError, handleOptions, json, logEvent, newRequestId } from "../_shared/http.ts";
import { requireAuth } from "../_shared/auth.ts";

const InputSchema = z.object({ jobId: z.string().uuid() });

Deno.serve(async (req) => {
  const opts = handleOptions(req);
  if (opts) return opts;
  const requestId = newRequestId();

  try {
    const ctx = await requireAuth(req);
    const parsed = InputSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Entrada inválida.");
    const { jobId } = parsed.data;

    const { data: isAdmin, error: gateErr } = await ctx.userClient.rpc("is_platform_admin");
    if (gateErr || !isAdmin) {
      throw new AppError("FORBIDDEN", "Acesso restrito ao administrador da plataforma.");
    }

    const { data: job } = await ctx.adminClient
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle();
    if (!job) throw new AppError("SEARCH_NOT_FOUND", "Job não encontrado.");
    if (job.status !== "failed") {
      throw new AppError("VALIDATION_ERROR", "Somente jobs falhos podem ser reprocessados.");
    }

    // Requeue (valid transition failed → queued), counting this as a new attempt.
    await ctx.adminClient
      .from("jobs")
      .update({
        status: "queued",
        attempt: (job.attempt ?? 0) + 1,
        error: null,
        result: null,
        finished_at: null,
      })
      .eq("id", jobId);

    // Re-run the enrichment for this specific place, as the caller.
    if (job.search_id && job.place_id) {
      const { error: invokeErr } = await ctx.userClient.functions.invoke("enrich-discovery", {
        body: { searchId: job.search_id, placeId: job.place_id },
      });
      if (invokeErr) {
        await ctx.adminClient
          .from("jobs")
          .update({ status: "failed", error: invokeErr.message ?? "Falha ao reexecutar." })
          .eq("id", jobId);
        throw new AppError("PROVIDER_UNAVAILABLE", "Falha ao reexecutar enriquecimento.");
      }
    }

    logEvent({ requestId, operation: "retry-job", status: "ok", jobId });
    return json({ ok: true, status: "queued" }, 200, {}, req);
  } catch (err) {
    if (err instanceof AppError) return err.toResponse(requestId, req);
    logEvent({ requestId, operation: "retry-job", status: "error" });
    return new AppError("INTERNAL_ERROR", "Erro interno.").toResponse(requestId, req);
  }
});
