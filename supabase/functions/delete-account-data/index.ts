// delete-account-data: LGPD — erases the caller's organization data
// (owner only) and the auth account when requested.
import { z } from "npm:zod@3";
import { AppError, handleOptions, json, logEvent, newRequestId } from "../_shared/http.ts";
import { requireAuth } from "../_shared/auth.ts";

const InputSchema = z.object({
  confirm: z.literal("EXCLUIR"),
  // Irreversible cascading delete — required, never inferred. Most users end
  // up with 2+ organizations (auto-created Free org + any invited org), so
  // guessing which one to delete is not acceptable here.
  organizationId: z.string().uuid(),
  deleteAuthAccount: z.boolean().default(false),
});

Deno.serve(async (req) => {
  const opts = handleOptions(req);
  if (opts) return opts;
  const requestId = newRequestId();

  try {
    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", 'Confirmação obrigatória: envie confirm="EXCLUIR".');
    }
    const ctx = await requireAuth(req, parsed.data.organizationId);
    if (ctx.role !== "owner") {
      throw new AppError("FORBIDDEN", "Apenas o proprietário pode excluir os dados.");
    }

    // Cascading FKs remove searches, places, leads, notes, activities, etc.
    const { error } = await ctx.adminClient
      .from("organizations")
      .delete()
      .eq("id", ctx.organizationId);
    if (error) throw new AppError("INTERNAL_ERROR", "Falha ao excluir organização.");

    if (parsed.data.deleteAuthAccount) {
      await ctx.adminClient.auth.admin.deleteUser(ctx.userId);
    }

    logEvent({
      requestId,
      operation: "delete-account-data",
      organizationId: ctx.organizationId,
      status: "ok",
    });
    return json({ deleted: true }, 200, {}, req);
  } catch (err) {
    if (err instanceof AppError) return err.toResponse(requestId, req);
    return new AppError("INTERNAL_ERROR", "Erro interno.").toResponse(requestId, req);
  }
});
