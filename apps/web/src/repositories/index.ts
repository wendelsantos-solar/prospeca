// Repository factory — resolves demo vs real by VITE_DATA_MODE.
// Real mode with missing config throws (config error screen upstream);
// there is NO silent fallback to mocks.
import { isRealMode, realConfigMissing } from "@/lib/env";
import type { DashboardRepository, LeadRepository, SearchRepository } from "./types";
import {
  SupabaseDashboardRepository,
  SupabaseLeadRepository,
  SupabaseSearchRepository,
} from "./supabase";
import {
  DemoDashboardRepository,
  DemoLeadRepository,
  DemoSearchRepository,
  seedDemoLeads,
} from "./demo";

function assertRealConfig() {
  const missing = realConfigMissing();
  if (missing.length > 0) {
    throw new Error(
      `Modo real ativo mas configuração incompleta: ${missing.join(", ")}. ` +
        "Configure as variáveis ou use VITE_DATA_MODE=demo em desenvolvimento.",
    );
  }
}

let leadRepo: LeadRepository | null = null;
let searchRepo: SearchRepository | null = null;
let dashboardRepo: DashboardRepository | null = null;

export function getLeadRepository(): LeadRepository {
  if (!leadRepo) {
    if (isRealMode) {
      assertRealConfig();
      leadRepo = new SupabaseLeadRepository();
    } else {
      leadRepo = new DemoLeadRepository();
    }
  }
  return leadRepo;
}

export function getSearchRepository(): SearchRepository {
  if (!searchRepo) {
    if (isRealMode) {
      assertRealConfig();
      searchRepo = new SupabaseSearchRepository();
    } else {
      searchRepo = new DemoSearchRepository();
    }
  }
  return searchRepo;
}

export function getDashboardRepository(): DashboardRepository {
  if (!dashboardRepo) {
    if (isRealMode) {
      assertRealConfig();
      dashboardRepo = new SupabaseDashboardRepository();
    } else {
      dashboardRepo = new DemoDashboardRepository();
    }
  }
  return dashboardRepo;
}

export * from "./types";
export { seedDemoLeads } from "./demo";
