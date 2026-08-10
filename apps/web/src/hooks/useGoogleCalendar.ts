import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  connectGoogleCalendar,
  createGoogleMeeting,
  disconnectGoogleCalendar,
  getGoogleCalendarStatus,
} from "@/lib/google-calendar-integration";
import { isDemoMode } from "@/lib/env";

const QUERY_KEY = ["integration", "google-calendar"] as const;

export function useGoogleCalendarStatus() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: getGoogleCalendarStatus,
    enabled: !isDemoMode,
    staleTime: 30_000,
    retry: false,
  });
}

export function useConnectGoogleCalendar() {
  return useMutation({ mutationFn: (returnTo?: string) => connectGoogleCalendar(returnTo) });
}

export function useDisconnectGoogleCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: disconnectGoogleCalendar,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useCreateGoogleMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createGoogleMeeting,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}
