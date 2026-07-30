// Create pilot access — admin-only endpoint.
// POST { email, organizationName, durationDays?, notes?, source? }
//
// Creates an organization with pilot plan, sends invitation to the email.
// The invited user signs up normally and accepts the invitation.

import { handleOptions, json, AppError, newRequestId } from "../_shared/http.ts";
import { requireAuth } from "../_shared/auth.ts";
import { assertRateLimit, scope } from "../_shared/rate-limit.ts";
import { captureError } from "../_shared/error-tracking.ts";
import { sendEmail } from "../_shared/email.ts";
import { z } from "npm:zod@3";

const createPilotSchema = z.object({
  email: z.string().email("E-mail inválido"),
  organizationName: z.string().min(2, "Nome da organização muito curto").max(200),
  durationDays: z.number().int().min(7).max(365).default(30),
  notes: z.string().max(2000).optional(),
  source: z.string().max(200).optional(),
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
    const body = createPilotSchema.parse(rawBody);

    // Admin only
    const { userId, adminClient } = await requireAuth(req);

    // Check platform admin
    const { data: isAdmin } = await adminClient.rpc("is_platform_admin");
    if (!isAdmin) {
      throw new AppError("FORBIDDEN", "Apenas administradores da plataforma podem criar pilotos.");
    }

    await assertRateLimit(adminClient, scope.byUser(userId), "create-pilot", {
      maxPerMinute: 5,
    });

    // Get the billing plan for pilot
    const { data: pilotPlan } = await adminClient
      .from("billing_plans")
      .select("id")
      .eq("code", "pilot")
      .single();

    if (!pilotPlan) {
      throw new AppError("INTERNAL_ERROR", "Plano Pilot não configurado no sistema.");
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + body.durationDays);

    // Create the organization
    const { data: org, error: orgError } = await adminClient
      .from("organizations")
      .insert({
        name: body.organizationName,
        slug:
          body.organizationName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 60) || undefined,
        owner_user_id: userId, // temporarily owned by admin
        plan: "pilot",
        status: "active",
        pilot_status: "invited",
        pilot_started_at: new Date().toISOString(),
        pilot_ends_at: expiresAt.toISOString(),
        pilot_notes: body.notes ?? null,
        pilot_source: body.source ?? null,
        monthly_search_limit: 60,
        monthly_place_limit: 1000,
      })
      .select("id")
      .single();

    if (orgError) {
      throw new AppError("INTERNAL_ERROR", "Falha ao criar organização piloto.", {
        detail: orgError.message,
      });
    }

    // Create subscription for pilot plan.
    // O erro É verificado: sem subscription a org existe com plan='pilot' mas os
    // entitlements (que leem subscriptions) caem no plano errado ou em nada.
    const { error: subError } = await adminClient.from("subscriptions").insert({
      organization_id: org.id,
      plan_id: pilotPlan.id,
      status: "trialing",
      trial_start: new Date().toISOString(),
      trial_end: expiresAt.toISOString(),
    });

    if (subError) {
      throw new AppError("INTERNAL_ERROR", "Falha ao criar assinatura do piloto.", {
        detail: subError.message,
      });
    }

    // Generate invitation for the pilot user
    const token = crypto.randomUUID();
    const encoder = new TextEncoder();
    const hash = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(token))),
    )
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const { error: invError } = await adminClient.from("organization_invitations").insert({
      organization_id: org.id,
      email: body.email,
      role: "owner",
      token_hash: hash,
      expires_at: expiresAt.toISOString(),
      invited_by: userId,
    });

    if (invError) {
      throw new AppError("INTERNAL_ERROR", "Falha ao criar convite.", {
        detail: invError.message,
      });
    }

    // Send invitation email (non-blocking — failure doesn't rollback pilot creation)
    const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:3000";
    const inviteUrl = `${appUrl}/cadastro?invitation=${token}`;
    sendEmail({
      to: body.email,
      subject: `Convite — Radar Local (Programa Pilot)`,
      html: `
        <h2>Você foi convidado para o Radar Local!</h2>
        <p>Olá! Você foi selecionado para participar do programa <strong>Pilot</strong> do Radar Local — uma plataforma de inteligência comercial e prospecção local.</p>
        <p><strong>Seu acesso é gratuito por ${body.durationDays} dias.</strong></p>
        <p>
          <a href="${inviteUrl}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;">
            Criar minha conta
          </a>
        </p>
        <p style="color:#666;font-size:12px;">
          Ou copie este link: ${inviteUrl}<br>
          Organização: ${body.organizationName}
        </p>
      `,
    }).catch(() => {
      // Email failure shouldn't block pilot creation
    });

    // Audit log
    await adminClient.from("audit_logs").insert({
      organization_id: org.id,
      actor_user_id: userId,
      action: "pilot_created",
      entity_type: "organization",
      entity_id: org.id,
      metadata: {
        email: body.email,
        durationDays: body.durationDays,
        source: body.source,
      },
    });

    return json({
      success: true,
      organizationId: org.id,
      invitationToken: token,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return new AppError("VALIDATION_ERROR", "Dados inválidos.", {
        fields: err.errors,
      }).toResponse(requestId, req);
    }
    if (err instanceof AppError) return err.toResponse(requestId, req);
    captureError(err, { location: "create-pilot", requestId });
    return new AppError("INTERNAL_ERROR", "Erro interno ao criar piloto.").toResponse(
      requestId,
      req,
    );
  }
});
