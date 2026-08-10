import { invokeFunction } from "@/lib/supabase";

export type GoogleCalendarConnectionStatus = "connected" | "reconnect_required" | "error";

export interface GoogleCalendarConnection {
  id: string;
  account_email: string | null;
  status: GoogleCalendarConnectionStatus;
  scopes: string[];
  settings: { calendar_id?: string; create_meet?: boolean };
  token_expires_at: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  updated_at: string;
}

export interface GoogleCalendarStatusResponse {
  configured: boolean;
  connection: GoogleCalendarConnection | null;
}

export interface GoogleCalendarEventLink {
  html_url: string | null;
  meeting_url: string | null;
  status: "pending" | "confirmed" | "cancelled" | "error";
}

export function getGoogleCalendarStatus() {
  return invokeFunction<GoogleCalendarStatusResponse>("google-calendar", { action: "status" });
}

export async function connectGoogleCalendar(returnTo = "/app/configuracoes?section=integracoes") {
  const result = await invokeFunction<{ authorizationUrl: string }>("google-calendar", {
    action: "authorization_url",
    returnTo,
  });
  window.location.assign(result.authorizationUrl);
}

export function disconnectGoogleCalendar() {
  return invokeFunction<{ disconnected: true }>("google-calendar", { action: "disconnect" });
}

export async function createGoogleMeeting(activityId: string) {
  const result = await invokeFunction<{ event: GoogleCalendarEventLink }>("google-calendar", {
    action: "create_event",
    activityId,
  });
  return result.event;
}
