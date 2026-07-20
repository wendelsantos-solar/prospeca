import type { LeadFilters, DashboardPeriod } from "@/types";

export interface SearchFilters {
  status?: string;
  page?: number;
}

export interface ResultFilters {
  onlyNotImported?: boolean;
  page?: number;
}

export const queryKeys = {
  searches: {
    all: ["searches"] as const,
    list: (filters: SearchFilters) => ["searches", "list", filters] as const,
    detail: (id: string) => ["searches", "detail", id] as const,
    status: (id: string) => ["searches", "status", id] as const,
    results: (id: string, filters: ResultFilters) => ["searches", id, "results", filters] as const,
  },
  leads: {
    all: ["leads"] as const,
    list: (filters: LeadFilters) => ["leads", "list", filters] as const,
    detail: (id: string) => ["leads", "detail", id] as const,
  },
  dashboard: {
    overview: (period: DashboardPeriod) => ["dashboard", "overview", period] as const,
  },
  quota: {
    status: ["quota", "status"] as const,
  },
  auth: {
    session: ["auth", "session"] as const,
    organization: ["auth", "organization"] as const,
  },
} as const;
