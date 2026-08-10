// Google Calendar integration hook — feature preview.
// Full implementation pending credentials / product decision.
// When GOOGLE_CALENDAR_CLIENT_ID is not set, the feature is unavailable
// (the UI shows appropriate "não configurado" state).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invokeFunction } from "@/lib/supabase";
import { isDemoMode } from "@/lib/env";

export interface GoogleCalendarStatus {
  configured: boolean;
  connection?: {
    status: "connected" | "expired" | "revoked";
    account_email: string;
    connected_at: string;
  };
}

export function useGoogleCalendarStatus() {
  return useQuery<GoogleCalendarStatus>({
    queryKey: ["google-calendar-status"],
    queryFn: async () => {
      if (isDemoMode) return { configured: false };
      const data = await invokeFunction("google-calendar", { action: "status" });
      return data as GoogleCalendarStatus;
    },
    staleTime: 5 * 60_000,
    retry: false,
    enabled: !isDemoMode,
  });
}

export function useConnectGoogleCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (returnPath: string) => {
      const data = await invokeFunction("google-calendar", {
        action: "connect",
        return_url: `${window.location.origin}${returnPath}`,
      });
      if (typeof data === "object" && data !== null && "auth_url" in data) {
        window.location.href = (data as { auth_url: string }).auth_url;
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["google-calendar-status"] });
    },
  });
}

export function useDisconnectGoogleCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await invokeFunction("google-calendar", { action: "disconnect" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["google-calendar-status"] });
    },
  });
}
