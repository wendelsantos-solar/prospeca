// get-admin-overview: painel de PLATAFORMA (super-admin). Chama os RPCs de
// agregacao com o JWT do usuario (via userClient) para que auth.uid() resolva e
// o gate is_platform_admin funcione. Nao-admin -> 403. Aceita janela `days`.
import { AppError, handleOptions, json, logEvent, newRequestId } from "../_shared/http.ts";
import { requireAuth } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const opts = handleOptions(req);
  if (opts) return opts;
  const requestId = newRequestId();

  try {
    const ctx = await requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const days = Math.min(365, Math.max(1, Number(body?.days) || 30));
    const from = new Date(Date.now() - days * 86400_000).toISOString();
    const to = new Date().toISOString();

    const uc = ctx.userClient;
    const [overview, orgs, series] = await Promise.all([
      uc.rpc("get_admin_overview", { p_from: from, p_to: to }),
      uc.rpc("get_admin_orgs", { p_from: from, p_to: to }),
      uc.rpc("get_admin_timeseries", { p_days: days }),
    ]);
    if (overview.error) {
      throw new AppError("FORBIDDEN", "Acesso restrito ao administrador da plataforma.");
    }
    logEvent({ requestId, operation: "get-admin-overview", status: "ok" });
    return json({
      days,
      overview: overview.data,
      orgs: orgs.data ?? [],
      timeseries: series.data ?? [],
    });
  } catch (err) {
    if (err instanceof AppError) return err.toResponse(requestId);
    return new AppError("INTERNAL_ERROR", "Erro interno.").toResponse(requestId);
  }
});
