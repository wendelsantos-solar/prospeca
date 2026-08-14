// get-admin-jobs: painel de PLATAFORMA para o pipeline assíncrono (spec #17).
// Lista os jobs recentes + contadores por status (incl. dead-letter), via RPCs
// security-definer chamados com o JWT do usuário (o gate is_platform_admin
// resolve auth.uid()). Não-admin → 403.
import { AppError, handleOptions, json, logEvent, newRequestId } from "../_shared/http.ts";
import { requireAuth } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const opts = handleOptions(req);
  if (opts) return opts;
  const requestId = newRequestId();

  try {
    const ctx = await requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const status = typeof body?.status === "string" && body.status ? body.status : null;
    const limit = Math.min(200, Math.max(1, Number(body?.limit) || 50));

    const uc = ctx.userClient;
    const [counts, jobs, metrics] = await Promise.all([
      uc.rpc("get_admin_job_counts"),
      uc.rpc("get_admin_jobs", { p_limit: limit, p_status: status }),
      uc.rpc("get_admin_job_metrics"),
    ]);
    if (counts.error) {
      throw new AppError("FORBIDDEN", "Acesso restrito ao administrador da plataforma.");
    }
    logEvent({ requestId, operation: "get-admin-jobs", status: "ok" });
    return json(
      { counts: counts.data, jobs: jobs.data ?? [], metrics: metrics.data ?? [] },
      200,
      {},
      req,
    );
  } catch (err) {
    if (err instanceof AppError) return err.toResponse(requestId, req);
    logEvent({ requestId, operation: "get-admin-jobs", status: "error" });
    return new AppError("INTERNAL_ERROR", "Erro interno.").toResponse(requestId, req);
  }
});
