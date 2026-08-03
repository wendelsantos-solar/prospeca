// Submit feedback / support request
// POST { type, category?, message, currentPage?, appVersion?, browser?, os? }

import { handleOptions, json, AppError, newRequestId } from "../_shared/http.ts";
import { requireAuth } from "../_shared/auth.ts";
import { assertRateLimit, scope } from "../_shared/rate-limit.ts";
import { sendEmail } from "../_shared/email.ts";
import { escapeHtml } from "../_shared/html.ts";
import { z } from "npm:zod@3";

const feedbackSchema = z.object({
  type: z.enum(["feedback", "bug", "question", "feature_request", "data_quality"]),
  category: z.string().max(200).optional(),
  message: z.string().min(1).max(5000),
  sentiment: z.enum(["frustrated", "neutral", "happy"]).optional(),
  goal: z.string().max(200).optional(),
  email: z.string().email().max(320).optional().or(z.literal("")),
  canContact: z.boolean().optional(),
  currentPage: z.string().max(500).optional(),
  appVersion: z.string().max(50).optional(),
  browser: z.string().max(200).optional(),
  operatingSystem: z.string().max(200).optional(),
  recentActions: z.array(z.string().max(100)).max(10).optional(),
  screenshotPath: z.string().max(500).optional(),
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

    if (body.screenshotPath) {
      const expectedPrefix = `${organizationId}/${userId}/`;
      const fileName = body.screenshotPath.slice(expectedPrefix.length);
      if (
        !body.screenshotPath.startsWith(expectedPrefix) ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpg|webp|gif)$/i.test(
          fileName,
        )
      ) {
        throw new AppError("VALIDATION_ERROR", "Caminho do anexo inválido.");
      }
    }

    // Rate limit: 5 envios por minuto por USUÁRIO. Escopo por usuário, não por
    // organização: com escopo por org um membro esgotaria a cota dos colegas.
    await assertRateLimit(adminClient, scope.byUser(userId), "submit-feedback");

    const { data: feedback, error } = await adminClient
      .from("feedback")
      .insert({
        organization_id: organizationId,
        user_id: userId,
        type: body.type,
        category: body.category ?? null,
        message: body.message,
        sentiment: body.sentiment ?? null,
        goal: body.goal ?? null,
        email: body.email || null,
        can_contact: body.canContact ?? false,
        current_page: body.currentPage ?? null,
        app_version: body.appVersion ?? null,
        browser: body.browser ?? null,
        operating_system: body.operatingSystem ?? null,
        recent_actions: body.recentActions ?? null,
        screenshot_path: body.screenshotPath ?? null,
        request_id: body.requestId ?? requestId,
      })
      .select("id")
      .single();

    if (error) {
      throw new AppError("INTERNAL_ERROR", "Falha ao registrar feedback.");
    }

    // Audit log
    await adminClient.from("audit_logs").insert({
      organization_id: organizationId,
      actor_user_id: userId,
      action: "feedback_submitted",
      entity_type: "feedback",
      entity_id: feedback.id,
      metadata: { type: body.type, category: body.category },
    });

    const notifyTo = Deno.env.get("ADMIN_ALERT_EMAIL");
    if (notifyTo) {
      let attachmentLink: string | undefined;
      if (body.screenshotPath) {
        const { data: signedUrl, error: signedUrlError } = await adminClient.storage
          .from("feedback-attachments")
          .createSignedUrl(body.screenshotPath, 7 * 24 * 60 * 60);
        if (!signedUrlError) attachmentLink = signedUrl?.signedUrl;
      }

      const safeMessage = escapeHtml(body.message).replaceAll("\n", "<br>");
      await sendEmail({
        to: notifyTo,
        subject: `Novo ${body.type} na Prospeca`,
        html: `
          <p><strong>Tipo:</strong> ${escapeHtml(body.type)}</p>
          ${body.sentiment ? `<p><strong>Sentimento:</strong> ${escapeHtml(body.sentiment)}</p>` : ""}
          ${body.goal ? `<p><strong>Objetivo:</strong> ${escapeHtml(body.goal)}</p>` : ""}
          ${body.email ? `<p><strong>E-mail:</strong> ${escapeHtml(body.email)}</p>` : ""}
          ${body.currentPage ? `<p><strong>Página:</strong> ${escapeHtml(body.currentPage)}</p>` : ""}
          <p><strong>Mensagem:</strong></p>
          <p>${safeMessage}</p>
          ${attachmentLink ? `<p><a href="${escapeHtml(attachmentLink)}">Abrir screenshot (link válido por 7 dias)</a></p>` : ""}
        `,
        text: [
          `Tipo: ${body.type}`,
          body.sentiment ? `Sentimento: ${body.sentiment}` : "",
          body.goal ? `Objetivo: ${body.goal}` : "",
          body.email ? `E-mail: ${body.email}` : "",
          body.currentPage ? `Página: ${body.currentPage}` : "",
          `Mensagem: ${body.message}`,
          attachmentLink ? `Screenshot (7 dias): ${attachmentLink}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      });
    }

    return json({
      success: true,
      message: body.email
        ? "Feedback registrado. Responderemos em até 48h no seu e-mail."
        : "Feedback registrado. Obrigado por ajudar a melhorar!",
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
