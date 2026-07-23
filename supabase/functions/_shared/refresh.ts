// Force-refresh decision (Fase 4 / D7). Pure so it is unit-testable without a
// live Supabase — execute-search calls this to decide whether a forceRefresh
// request actually bypasses the cache or falls back to normal cached serving.

export const FORCE_COOLDOWN_MS = 10 * 60_000; // 10 min

/**
 * Whether to actually force a paid re-fetch.
 * - not requested            -> false (use cache)
 * - requested, no prior force -> true
 * - requested, but the same cache key was force-fetched within the cooldown
 *   window -> false (blocks accidental cost loops; serve cache instead)
 */
export function shouldForceRefresh(
  forceRefresh: boolean,
  lastForcedAtMs: number | null,
  nowMs: number,
  cooldownMs: number = FORCE_COOLDOWN_MS,
): boolean {
  if (!forceRefresh) return false;
  if (lastForcedAtMs != null && nowMs - lastForcedAtMs < cooldownMs) return false;
  return true;
}
