// Search status state machine. Single source of truth for allowed transitions
// so API, worker and UI agree on progress semantics.
import type { SearchStatus } from "@leads/contracts";

const TRANSITIONS: Record<SearchStatus, SearchStatus[]> = {
  queued: ["geocoding", "searching", "cancelled", "failed"],
  geocoding: ["discovering", "searching", "cancelled", "failed"],
  searching: ["discovering", "normalizing", "importing", "cancelled", "failed", "partial"],
  discovering: ["normalizing", "cancelled", "failed", "partial"],
  normalizing: ["deduplicating", "cancelled", "failed"],
  deduplicating: ["persisting", "importing", "cancelled", "failed"],
  importing: ["persisting", "enriching", "completed", "partial", "cancelled", "failed"],
  persisting: ["enriching", "completed", "partial", "cancelled", "failed"],
  enriching: ["completed", "partially_completed", "partial", "failed", "cancelled"],
  completed: [],
  partial: [],
  partially_completed: [],
  failed: [],
  cancelled: [],
};

export const TERMINAL_STATUSES: SearchStatus[] = [
  "completed",
  "partial",
  "partially_completed",
  "failed",
  "cancelled",
];

export function isTerminal(status: SearchStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function canTransition(from: SearchStatus, to: SearchStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
