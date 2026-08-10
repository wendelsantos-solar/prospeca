import { AppError } from "./http.ts";

export const GOOGLE_CALENDAR_PROVIDER = "google_calendar" as const;
export const GOOGLE_CALENDAR_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events.owned",
] as const;

export interface GoogleTokenPayload {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  tokenType: string;
}

export interface CalendarActivity {
  id: string;
  title: string;
  description?: string | null;
  scheduledAt: string;
  scheduledEndAt?: string | null;
  timezone: string;
  attendeeEmail?: string | null;
  leadName: string;
}

export interface GoogleCalendarEvent {
  id: string;
  etag?: string;
  htmlLink?: string;
  hangoutLink?: string;
  status?: string;
  conferenceData?: {
    entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
    createRequest?: { status?: { statusCode?: string } };
  };
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new AppError("FEATURE_NOT_AVAILABLE", `${name} não configurado.`);
  }
  return value;
}

export function googleCalendarConfig() {
  const supabaseUrl = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
  return {
    clientId: requiredEnv("GOOGLE_CALENDAR_CLIENT_ID"),
    clientSecret: requiredEnv("GOOGLE_CALENDAR_CLIENT_SECRET"),
    redirectUri:
      Deno.env.get("GOOGLE_CALENDAR_REDIRECT_URI")?.trim() ||
      `${supabaseUrl}/functions/v1/google-calendar/callback`,
    appUrl: requiredEnv("APP_URL").replace(/\/$/, ""),
  };
}

export function buildGoogleAuthorizationUrl(state: string): string {
  const config = googleCalendarConfig();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_CALENDAR_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent select_account");
  url.searchParams.set("state", state);
  return url.toString();
}

export function safeReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/app/configuracoes?section=integracoes";
  }
  return value.slice(0, 500);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return bytes.buffer as ArrayBuffer;
}

function encryptionKey(): Promise<CryptoKey> {
  const raw = base64ToBytes(requiredEnv("INTEGRATION_TOKEN_ENCRYPTION_KEY"));
  if (raw.byteLength !== 32) {
    throw new AppError(
      "FEATURE_NOT_AVAILABLE",
      "INTEGRATION_TOKEN_ENCRYPTION_KEY deve conter 32 bytes em base64.",
    );
  }
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptTokenPayload(
  payload: GoogleTokenPayload,
): Promise<{ encryptedPayload: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(),
    encoded,
  );
  return {
    encryptedPayload: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv),
  };
}

export async function decryptTokenPayload(
  encryptedPayload: string,
  iv: string,
): Promise<GoogleTokenPayload> {
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(iv) },
      await encryptionKey(),
      base64ToBytes(encryptedPayload),
    );
    return JSON.parse(new TextDecoder().decode(decrypted)) as GoogleTokenPayload;
  } catch {
    throw new AppError("INTERNAL_ERROR", "Não foi possível ler a credencial da integração.");
  }
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function googleTokenRequest(params: URLSearchParams): Promise<Record<string, unknown>> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const invalidGrant = data.error === "invalid_grant";
    throw new AppError(
      invalidGrant ? "UNAUTHORIZED" : "PROVIDER_UNAVAILABLE",
      invalidGrant
        ? "A autorização do Google expirou ou foi revogada. Reconecte sua conta."
        : "O Google não concluiu a autorização. Tente novamente.",
    );
  }
  return data;
}

export async function exchangeAuthorizationCode(code: string): Promise<GoogleTokenPayload> {
  const config = googleCalendarConfig();
  const data = await googleTokenRequest(
    new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
  );
  if (typeof data.access_token !== "string" || typeof data.refresh_token !== "string") {
    throw new AppError(
      "PROVIDER_UNAVAILABLE",
      "O Google não retornou acesso offline. Remova o acesso anterior e conecte novamente.",
    );
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + Number(data.expires_in ?? 3600) * 1000).toISOString(),
    tokenType: typeof data.token_type === "string" ? data.token_type : "Bearer",
  };
}

export async function refreshGoogleAccessToken(
  payload: GoogleTokenPayload,
): Promise<GoogleTokenPayload> {
  const config = googleCalendarConfig();
  const data = await googleTokenRequest(
    new URLSearchParams({
      refresh_token: payload.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
    }),
  );
  if (typeof data.access_token !== "string") {
    throw new AppError("PROVIDER_UNAVAILABLE", "O Google não renovou a autorização.");
  }
  return {
    ...payload,
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + Number(data.expires_in ?? 3600) * 1000).toISOString(),
    tokenType: typeof data.token_type === "string" ? data.token_type : payload.tokenType,
  };
}

export async function ensureFreshToken(payload: GoogleTokenPayload): Promise<GoogleTokenPayload> {
  if (new Date(payload.expiresAt).getTime() > Date.now() + 60_000) {
    return payload;
  }
  return await refreshGoogleAccessToken(payload);
}

export async function fetchGoogleIdentity(accessToken: string) {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new AppError("PROVIDER_UNAVAILABLE", "Não foi possível identificar a conta Google.");
  }
  const data = (await response.json()) as { sub?: string; email?: string };
  if (!data.sub || !data.email) {
    throw new AppError("PROVIDER_UNAVAILABLE", "A conta Google não informou um e-mail válido.");
  }
  return { accountId: data.sub, email: data.email };
}

export async function googleEventId(activityId: string): Promise<string> {
  return `prospeca${await sha256Hex(activityId)}`;
}

export function buildCalendarEventBody(activity: CalendarActivity, createMeet = true) {
  const start = new Date(activity.scheduledAt);
  const end = activity.scheduledEndAt
    ? new Date(activity.scheduledEndAt)
    : new Date(start.getTime() + 30 * 60_000);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    throw new AppError("VALIDATION_ERROR", "Data ou duração da reunião inválida.");
  }

  return {
    summary: activity.title,
    description: [
      `Oportunidade: ${activity.leadName}`,
      activity.description?.trim(),
      "Criado pela Prospeca.",
    ]
      .filter(Boolean)
      .join("\n\n"),
    start: { dateTime: start.toISOString(), timeZone: activity.timezone },
    end: { dateTime: end.toISOString(), timeZone: activity.timezone },
    attendees: activity.attendeeEmail ? [{ email: activity.attendeeEmail }] : undefined,
    extendedProperties: { private: { prospecaActivityId: activity.id } },
    conferenceData: createMeet
      ? {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        }
      : undefined,
  };
}

export function meetingUrlFromEvent(event: GoogleCalendarEvent): string | null {
  return (
    event.hangoutLink ??
    event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")?.uri ??
    null
  );
}

export async function createGoogleCalendarEvent(input: {
  accessToken: string;
  calendarId: string;
  eventId: string;
  activity: CalendarActivity;
  createMeet: boolean;
}): Promise<GoogleCalendarEvent> {
  const query = new URLSearchParams({ conferenceDataVersion: "1" });
  if (input.activity.attendeeEmail) query.set("sendUpdates", "all");
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      input.calendarId,
    )}/events?${query}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: input.eventId,
        ...buildCalendarEventBody(input.activity, input.createMeet),
      }),
    },
  );

  if (response.status === 409) {
    const existing = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        input.calendarId,
      )}/events/${input.eventId}`,
      { headers: { Authorization: `Bearer ${input.accessToken}` } },
    );
    if (existing.ok) return (await existing.json()) as GoogleCalendarEvent;
  }

  const data = (await response.json().catch(() => ({}))) as GoogleCalendarEvent & {
    error?: { message?: string };
  };
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new AppError("UNAUTHORIZED", "O Google recusou o acesso. Reconecte sua conta.");
    }
    throw new AppError(
      "PROVIDER_UNAVAILABLE",
      data.error?.message || "Não foi possível criar o evento no Google Calendar.",
    );
  }
  return data;
}

export async function revokeGoogleToken(token: string): Promise<void> {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  }).catch(() => undefined);
}
