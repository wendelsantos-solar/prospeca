import type { PresenceFilter } from "@/types";

/**
 * Deterministic "mission" sentence derived from the structured filters. This is
 * NOT an LLM — it's a friendly interpretation of exactly what the user chose,
 * so the search form reads like an intent ("missão de prospecção") rather than a
 * bare form. No fabrication: only the niche/location/presence/radius the user
 * actually picked are mentioned.
 */

export interface MissionInput {
  niche: string;
  location: string;
  presence: PresenceFilter;
  radiusKm: number;
}

const PRESENCE_QUALIFIER: Record<PresenceFilter, string | null> = {
  "no-website": "com baixa presença digital",
  "with-website": "com site próprio",
  all: null,
};

export function buildMissionPhrase(input: MissionInput): string | null {
  const niche = input.niche.trim();
  const location = input.location.trim();
  if (niche.length < 2 || !location) return null;

  const qualifier = PRESENCE_QUALIFIER[input.presence];
  const radiusKm = input.radiusKm > 0 ? input.radiusKm : null;

  const parts = [niche];
  if (qualifier) parts.push(qualifier);
  parts.push(`em ${location}`);
  const base = parts.join(" ");

  return radiusKm != null ? `${base}, raio ${radiusKm} km` : base;
}
