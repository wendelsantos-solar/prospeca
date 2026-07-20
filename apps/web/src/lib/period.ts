import { startOfDay, startOfYear, subDays, differenceInCalendarDays } from "date-fns";
import type { Lead, DashboardPeriod } from "@/types";

export interface PeriodWindow {
  from: Date;
  to: Date;
}

export function resolvePeriod(
  period: DashboardPeriod,
  customFrom?: string,
  customTo?: string,
): PeriodWindow {
  const today = new Date();
  switch (period) {
    case "today":
      return { from: startOfDay(today), to: today };
    case "7d":
      return { from: subDays(today, 7), to: today };
    case "30d":
      return { from: subDays(today, 30), to: today };
    case "90d":
      return { from: subDays(today, 90), to: today };
    case "year":
      return { from: startOfYear(today), to: today };
    case "custom": {
      const from = customFrom ? new Date(`${customFrom}T00:00:00`) : subDays(today, 30);
      const to = customTo ? new Date(`${customTo}T23:59:59`) : today;
      return from <= to ? { from, to } : { from: to, to: from };
    }
  }
}

export function previousWindow(win: PeriodWindow): PeriodWindow {
  const days = Math.max(1, differenceInCalendarDays(win.to, win.from));
  return { from: subDays(win.from, days), to: win.from };
}

export function inWindow(iso: string | undefined, win: PeriodWindow): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return d >= win.from && d <= win.to;
}

/** Leads descobertos dentro da janela. */
export function leadsInWindow(leads: Lead[], win: PeriodWindow): Lead[] {
  return leads.filter((l) => inWindow(l.discoveredAt, win));
}

/** Variação percentual vs. período anterior; null quando não comparável. */
export function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}
