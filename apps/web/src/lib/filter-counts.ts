import type { Lead, LeadFilters } from "@/types";
import { QUICK_FILTERS, applyFilters } from "@/lib/filters";

/**
 * For each quick-filter chip, the number of leads that would remain if that
 * chip were toggled ON alongside the currently-active filters. Already-active
 * chips report the current filtered count.
 */
export function quickFilterCounts(leads: Lead[], active: LeadFilters): Record<string, number> {
  const out: Record<string, number> = {};
  for (const chip of QUICK_FILTERS) {
    const quick = active.quick.includes(chip.id) ? active.quick : [...active.quick, chip.id];
    out[chip.id] = applyFilters(leads, { ...active, quick }).length;
  }
  return out;
}
