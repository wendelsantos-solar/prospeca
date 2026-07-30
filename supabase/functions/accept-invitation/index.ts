// Accept organization invitation — consome o token, adiciona membro à org.
// POST { token: string }

import { handleOptions, json, AppError, newRequestId } from "../_shared/http.ts";
import { adminClient } from "../_shared/auth.ts";
import { assertRateLimit } from "../_shared/rate-limit.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  const opts = handleOptions(req);
  if (opts) return opts;

  const requestId = newRequestId();

  try {
    if (req.method !== "POST") {
      throw new AppError("VALIDATION_ERROR", "Método não permitido.");
    }

    const body = await req.json();
    const { token } = body ?? {};
    if (!token || typeof token !== "string" || token.length < 10) {
      throw new AppError("VALIDATION_ERROR", "Token inválido ou ausente.");
    }

    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new AppError("UNAUTHORIZED", "Autenticação necessária.");

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      throw new AppError("UNAUTHORIZED", "Sessão inválida ou expirada.");
    }

    const admin = adminClient();

    // Rate limit: 5 invitation accept attempts per minute per IP-like scope
    // (uses a synthetic organization lookup for rate limiting)
    await assertRateLimit(admin, "00000000-0000-0000-0000-000000000000", "accept-invitation", {
      maxPerMinute: 5,
      message: "Muitas tentativas. Aguarde um momento.",
    });

    const tokenHash = await hashToken(token);

    // Find the invitation
    const { data: invitation, error: invError } = await admin
      .from("organization_invitations")
      .select("*")
      .eq("token_hash", tokenHash)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .maybeSingle();

    if (invError || !invitation) {
      throw new AppError("VALIDATION_ERROR", "Convite não encontrado ou já utilizado.");
    }

    // Check expiration
    if (new Date(invitation.expires_at) < new Date()) {
      throw new AppError("VALIDATION_ERROR", "Este convite expirou.");
    }

    // Check email match (the logged-in user must match the invited email)
    if (userData.user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new AppError(
        "FORBIDDEN",
        "Este convite é para outro e-mail. Faça login com o e-mail correto.",
      );
    }

    // Check if user is already a member
    const { data: existing } = await admin
      .from("organization_members")
      .select("id")
      .eq("organization_id", invitation.organization_id)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (existing) {
      // Already a member — mark invitation as accepted anyway
      await admin
        .from("organization_invitations")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", invitation.id);

      return json({
        success: true,
        organizationId: invitation.organization_id,
        alreadyMember: true,
      });
    }

    // Add membership
    const { error: memberError } = await admin.from("organization_members").insert({
      organization_id: invitation.organization_id,
      user_id: userData.user.id,
      role: invitation.role,
    });

    if (memberError) {
      throw new AppError("INTERNAL_ERROR", "Falha ao adicionar membro à organização.");
    }

    // Mark invitation as accepted
    await admin
      .from("organization_invitations")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invitation.id);

    // Audit log
    await admin.from("audit_logs").insert({
      organization_id: invitation.organization_id,
      actor_user_id: userData.user.id,
      action: "invitation_accepted",
      entity_type: "organization_invitation",
      entity_id: invitation.id,
    });

    return json({
      success: true,
      organizationId: invitation.organization_id,
      role: invitation.role,
    });
  } catch (err) {
    if (err instanceof AppError) return err.toResponse(requestId, req);
    console.error("accept-invitation unexpected error:", err);
    return new AppError("INTERNAL_ERROR", "Erro interno ao processar convite.").toResponse(
      requestId,
      req,
    );
  }
});

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
