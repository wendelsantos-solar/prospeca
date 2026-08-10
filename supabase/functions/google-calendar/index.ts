import { z } from "npm:zod@3";
import { adminClient, requireAuth } from "../_shared/auth.ts";
import {
  AppError,
  captureAndRespond,
  handleOptions,
  json,
  logEvent,
  newRequestId,
  responseHeaders,
} from "../_shared/http.ts";
import {
  buildGoogleAuthorizationUrl,
  createGoogleCalendarEvent,
  decryptTokenPayload,
  encryptTokenPayload,
  ensureFreshToken,
  exchangeAuthorizationCode,
  fetchGoogleIdentity,
  GOOGLE_CALENDAR_PROVIDER,
  GOOGLE_CALENDAR_SCOPES,
  googleCalendarConfig,
  googleEventId,
  meetingUrlFromEvent,
  revokeGoogleToken,
  safeReturnTo,
  sha256Hex,
} from "../_shared/google-calendar.ts";

const ActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status") }),
  z.object({
    action: z.literal("authorization_url"),
    returnTo: z.string().max(500).optional(),
  }),
  z.object({ action: z.literal("disconnect") }),
  z.object({
    action: z.literal("create_event"),
    activityId: z.string().uuid(),
  }),
]);

function isConfigured(): boolean {
  return [
    "SUPABASE_URL",
    "GOOGLE_CALENDAR_CLIENT_ID",
    "GOOGLE_CALENDAR_CLIENT_SECRET",
    "INTEGRATION_TOKEN_ENCRYPTION_KEY",
    "APP_URL",
  ].every((name) => Boolean(Deno.env.get(name)?.trim()));
}

function redirectToApp(returnTo: string, result: "connected" | "error", message?: string) {
  const { appUrl } = googleCalendarConfig();
  const url = new URL(safeReturnTo(returnTo), `${appUrl}/`);
  url.searchParams.set("integration", `google-calendar-${result}`);
  if (message) {
    url.searchParams.set("integration_message", message.slice(0, 180));
  }
  return new Response(null, {
    status: 302,
    headers: {
      ...responseHeaders(),
      Location: url.toString(),
      "Cache-Control": "no-store",
    },
  });
}

async function handleCallback(req: Request): Promise<Response> {
  const requestUrl = new URL(req.url);
  const state = requestUrl.searchParams.get("state") ?? "";
  const code = requestUrl.searchParams.get("code") ?? "";
  const providerError = requestUrl.searchParams.get("error");
  if (!state) throw new AppError("VALIDATION_ERROR", "Estado OAuth ausente.");

  const admin = adminClient();
  const stateHash = await sha256Hex(state);
  const { data: oauthState, error: consumeError } = await admin
    .from("integration_oauth_states")
    .delete()
    .eq("state_hash", stateHash)
    .eq("provider", GOOGLE_CALENDAR_PROVIDER)
    .gt("expires_at", new Date().toISOString())
    .select("organization_id, user_id, return_to")
    .maybeSingle();

  if (consumeError || !oauthState) {
    throw new AppError("UNAUTHORIZED", "Esta autorização expirou. Inicie a conexão novamente.");
  }
  if (providerError || !code) {
    return redirectToApp(
      oauthState.return_to,
      "error",
      providerError === "access_denied"
        ? "Autorização cancelada."
        : "O Google não autorizou a conexão.",
    );
  }

  try {
    const tokens = await exchangeAuthorizationCode(code);
    const identity = await fetchGoogleIdentity(tokens.accessToken);
    const { encryptedPayload, iv } = await encryptTokenPayload(tokens);
    const { data: connection, error: connectionError } = await admin
      .from("integration_connections")
      .upsert(
        {
          organization_id: oauthState.organization_id,
          user_id: oauthState.user_id,
          provider: GOOGLE_CALENDAR_PROVIDER,
          provider_account_id: identity.accountId,
          account_email: identity.email,
          status: "connected",
          scopes: [...GOOGLE_CALENDAR_SCOPES],
          token_expires_at: tokens.expiresAt,
          last_error: null,
        },
        { onConflict: "organization_id,user_id,provider" },
      )
      .select("id")
      .single();
    if (connectionError || !connection) {
      throw connectionError ?? new Error("connection missing");
    }

    const { error: credentialError } = await admin.from("integration_credentials").upsert({
      connection_id: connection.id,
      encrypted_payload: encryptedPayload,
      iv,
    });
    if (credentialError) throw credentialError;

    logEvent({
      operation: "google-calendar.oauth-callback",
      status: "ok",
      organizationId: oauthState.organization_id,
      userId: oauthState.user_id,
    });
    return redirectToApp(oauthState.return_to, "connected");
  } catch (error) {
    const message =
      error instanceof AppError ? error.message : "Não foi possível concluir a conexão.";
    return redirectToApp(oauthState.return_to, "error", message);
  }
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const requestId = newRequestId();

  try {
    const pathname = new URL(req.url).pathname;
    if (req.method === "GET" && pathname.endsWith("/callback")) {
      return await handleCallback(req);
    }
    if (req.method !== "POST") {
      throw new AppError("VALIDATION_ERROR", "Método não suportado.");
    }

    const ctx = await requireAuth(req);
    const parsed = ActionSchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", "Ação de integração inválida.");
    }

    if (parsed.data.action === "status") {
      const { data, error } = await ctx.adminClient
        .from("integration_connections")
        .select(
          "id, account_email, status, scopes, settings, token_expires_at, last_synced_at, last_error, updated_at",
        )
        .eq("organization_id", ctx.organizationId)
        .eq("user_id", ctx.userId)
        .eq("provider", GOOGLE_CALENDAR_PROVIDER)
        .maybeSingle();
      if (error) throw error;
      return json({ configured: isConfigured(), connection: data ?? null }, 200, {}, req);
    }

    if (parsed.data.action === "authorization_url") {
      googleCalendarConfig();
      const stateBytes = crypto.getRandomValues(new Uint8Array(32));
      const state = Array.from(stateBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
      const stateHash = await sha256Hex(state);
      const returnTo = safeReturnTo(parsed.data.returnTo);
      const { error } = await ctx.adminClient.from("integration_oauth_states").insert({
        state_hash: stateHash,
        organization_id: ctx.organizationId,
        user_id: ctx.userId,
        provider: GOOGLE_CALENDAR_PROVIDER,
        return_to: returnTo,
        expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      });
      if (error) throw error;
      return json({ authorizationUrl: buildGoogleAuthorizationUrl(state) }, 200, {}, req);
    }

    const { data: connection, error: connectionError } = await ctx.adminClient
      .from("integration_connections")
      .select("id, account_email, status, settings")
      .eq("organization_id", ctx.organizationId)
      .eq("user_id", ctx.userId)
      .eq("provider", GOOGLE_CALENDAR_PROVIDER)
      .maybeSingle();
    if (connectionError) throw connectionError;

    if (parsed.data.action === "disconnect") {
      if (connection) {
        const { data: credential } = await ctx.adminClient
          .from("integration_credentials")
          .select("encrypted_payload, iv")
          .eq("connection_id", connection.id)
          .maybeSingle();
        if (credential) {
          try {
            const tokens = await decryptTokenPayload(credential.encrypted_payload, credential.iv);
            await revokeGoogleToken(tokens.refreshToken);
          } catch {
            // Local deletion must remain possible after a key rotation or a
            // provider outage. Revocation is best-effort in that edge case.
          }
        }
        const { error } = await ctx.adminClient
          .from("integration_connections")
          .delete()
          .eq("id", connection.id);
        if (error) throw error;
      }
      return json({ disconnected: true }, 200, {}, req);
    }

    if (!connection || connection.status !== "connected") {
      throw new AppError(
        "FEATURE_NOT_AVAILABLE",
        "Conecte o Google Calendar antes de criar a reunião.",
      );
    }
    const { data: credential } = await ctx.adminClient
      .from("integration_credentials")
      .select("encrypted_payload, iv")
      .eq("connection_id", connection.id)
      .single();
    if (!credential) {
      throw new AppError("FEATURE_NOT_AVAILABLE", "Credencial Google não encontrada.");
    }

    const { data: activity } = await ctx.adminClient
      .from("lead_activities")
      .select(
        "id, title, description, type, scheduled_at, scheduled_end_at, timezone, attendee_email, leads!inner(company_name)",
      )
      .eq("id", parsed.data.activityId)
      .eq("organization_id", ctx.organizationId)
      .maybeSingle();
    if (!activity) {
      throw new AppError("LEAD_NOT_FOUND", "Atividade não encontrada.");
    }
    if (activity.type !== "meeting" || !activity.scheduled_at) {
      throw new AppError(
        "VALIDATION_ERROR",
        "A atividade precisa ser uma reunião com data e horário.",
      );
    }

    let tokens = await decryptTokenPayload(credential.encrypted_payload, credential.iv);
    try {
      const refreshed = await ensureFreshToken(tokens);
      if (refreshed.accessToken !== tokens.accessToken) {
        tokens = refreshed;
        const encrypted = await encryptTokenPayload(tokens);
        await ctx.adminClient
          .from("integration_credentials")
          .update({
            encrypted_payload: encrypted.encryptedPayload,
            iv: encrypted.iv,
          })
          .eq("connection_id", connection.id);
        await ctx.adminClient
          .from("integration_connections")
          .update({
            token_expires_at: tokens.expiresAt,
            status: "connected",
            last_error: null,
          })
          .eq("id", connection.id);
      }

      const settings = (connection.settings ?? {}) as {
        calendar_id?: string;
        create_meet?: boolean;
      };
      const calendarId = settings.calendar_id || "primary";
      const event = await createGoogleCalendarEvent({
        accessToken: tokens.accessToken,
        calendarId,
        eventId: await googleEventId(activity.id),
        activity: {
          id: activity.id,
          title: activity.title,
          description: activity.description,
          scheduledAt: activity.scheduled_at,
          scheduledEndAt: activity.scheduled_end_at,
          timezone: activity.timezone || "America/Sao_Paulo",
          attendeeEmail: activity.attendee_email,
          leadName:
            (activity.leads as unknown as { company_name?: string } | null)?.company_name ??
            "Oportunidade",
        },
        createMeet: settings.create_meet !== false,
      });
      const meetingUrl = meetingUrlFromEvent(event);
      const eventStatus =
        event.conferenceData?.createRequest?.status?.statusCode === "pending"
          ? "pending"
          : "confirmed";
      const { data: external, error: externalError } = await ctx.adminClient
        .from("activity_external_events")
        .upsert(
          {
            organization_id: ctx.organizationId,
            user_id: ctx.userId,
            activity_id: activity.id,
            connection_id: connection.id,
            provider: GOOGLE_CALENDAR_PROVIDER,
            external_event_id: event.id,
            calendar_id: calendarId,
            html_url: event.htmlLink ?? null,
            meeting_url: meetingUrl,
            etag: event.etag ?? null,
            status: eventStatus,
          },
          { onConflict: "connection_id,activity_id" },
        )
        .select("html_url, meeting_url, status")
        .single();
      if (externalError) throw externalError;
      await ctx.adminClient
        .from("integration_connections")
        .update({
          last_synced_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", connection.id);
      return json({ event: external }, 200, {}, req);
    } catch (error) {
      const reconnect = error instanceof AppError && error.code === "UNAUTHORIZED";
      await ctx.adminClient
        .from("integration_connections")
        .update({
          status: reconnect ? "reconnect_required" : "error",
          last_error: error instanceof Error ? error.message.slice(0, 500) : "Falha desconhecida",
        })
        .eq("id", connection.id);
      throw error;
    }
  } catch (error) {
    if (error instanceof AppError) return error.toResponse(requestId, req);
    return captureAndRespond(error, requestId, "google-calendar", req);
  }
});
