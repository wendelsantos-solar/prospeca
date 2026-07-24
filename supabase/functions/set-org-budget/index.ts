// set-org-budget: super-admin define teto de gasto US$/mes de uma org. Gate via
// RPC (userClient para auth.uid resolver). null = ilimitado.
import { z } from "npm:zod@3";
import { AppError, handleOptions, json, logEvent, newRequestId } from "../_shared/http.ts";
import { requireAuth } from "../_shared/auth.ts";

const InputSchema = z.object({
  orgId: z.string().uuid(),
  budget: z.number().min(0).max(1000000).nullable(),
});

Deno.serve(async (req) => {
  const opts = handleOptions(req);
  if (opts) return opts;
  const requestId = newRequestId();
  try {
    const ctx = await requireAuth(req);
    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Entrada invalida.");
    const { error } = await ctx.userClient.rpc("set_org_budget", {
      p_org: parsed.data.orgId,
      p_budget: parsed.data.budget,
    });
    if (error) throw new AppError("FORBIDDEN", "Acesso restrito ao administrador da plataforma.");
    logEvent({ requestId, operation: "set-org-budget", status: "ok" });
    return json({ ok: true }, 200, {}, req);
  } catch (err) {
    if (err instanceof AppError) return err.toResponse(requestId, req);
    return new AppError("INTERNAL_ERROR", "Erro interno.").toResponse(requestId, req);
  }
});
