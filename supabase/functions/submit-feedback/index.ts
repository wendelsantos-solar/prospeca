// Submit feedback / support request
// POST { type, category?, message, currentPage?, appVersion?, browser?, os? }

import { handleOptions, json, AppError, newRequestId } from "../_shared/http.ts";
import { requireAuth } from "../_shared/auth.ts";
import { assertRateLimit } from "../_shared/rate-limit.ts";
import { z } from "npm:zod@3";

const feedbackSchema = z.object({
  type: z.enum(["feedback", "bug", "question", "feature_request", "data_quality"]),
  category: z.string().max(200).optional(),
  message: z.string().min(1).max(5000),
  currentPage: z.string().max(500).optional(),
  appVersion: z.string().max(50).optional(),
  browser: z.string().max(200).optional(),
  operatingSystem: z.string().max(200).optional(),
  requestId: z.string().max(100).optional(),
});

Deno.serve(async (req: Request) => {
  const opts = handleOptions(req);
  if (opts) return opts;

  const requestId = newRequestId();

  try {
    if (req.method !== "POST") {
      throw new AppError("VALIDATION_ERROR", "Método não permitido.");
    }

    const rawBody = await req.json();
    const body = feedbackSchema.parse(rawBody);

    const { userId, organizationId, adminClient } = await requireAuth(req);

    // Rate limit: 5 feedback submissions per minute per org
    await assertRateLimit(adminClient, organizationId, "submit-feedback");

    const { error } = await adminClient.from("feedback").insert({
      organization_id: organizationId,
      user_id: userId,
      type: body.type,
      category: body.category ?? null,
      message: body.message,
      current_page: body.currentPage ?? null,
      app_version: body.appVersion ?? null,
      browser: body.browser ?? null,
      operating_system: body.operatingSystem ?? null,
      request_id: body.requestId ?? requestId,
    });

    if (error) {
      throw new AppError("INTERNAL_ERROR", "Falha ao registrar feedback.");
    }

    // Audit log
    await adminClient.from("audit_logs").insert({
      organization_id: organizationId,
      actor_user_id: userId,
      action: "feedback_submitted",
      entity_type: "feedback",
      metadata: { type: body.type, category: body.category },
    });

    return json({
      success: true,
      message: "Feedback registrado. Obrigado!",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return new AppError("VALIDATION_ERROR", "Dados inválidos.", {
        fields: err.errors,
      }).toResponse(requestId, req);
    }
    if (err instanceof AppError) return err.toResponse(requestId, req);
    console.error("submit-feedback unexpected error:", err);
    return new AppError("INTERNAL_ERROR", "Erro interno.").toResponse(requestId, req);
  }
});
