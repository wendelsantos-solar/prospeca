// API DTOs shared between web and edge functions. Zod = single source of truth
// for validation + inferred TS types.
import { z } from "zod";

export const SEARCH_STATUSES = [
  "queued",
  "geocoding",
  "searching",
  "discovering",
  "normalizing",
  "deduplicating",
  "importing",
  "persisting",
  "enriching",
  "completed",
  "partial",
  "partially_completed",
  "failed",
  "cancelled",
] as const;
export type SearchStatus = (typeof SEARCH_STATUSES)[number];

export const PRESENCE_FILTERS = ["all", "with_website", "without_website"] as const;
export type PresenceFilter = (typeof PRESENCE_FILTERS)[number];

// Hard safety bounds (also enforced server-side).
export const MAX_RADIUS_KM = 50;
export const MAX_RESULTS = 120;

export const CreateSearchInput = z.object({
  query: z.string().min(1).max(120),
  category: z.string().max(120).nullish(),
  location: z.string().min(1).max(200),
  radiusKm: z.number().positive().max(MAX_RADIUS_KM),
  filters: z
    .object({
      presence: z.enum(PRESENCE_FILTERS).default("all"),
    })
    .default({ presence: "all" }),
});
export type CreateSearchInput = z.infer<typeof CreateSearchInput>;

export const CreateSearchResponse = z.object({
  searchId: z.string(),
  jobId: z.string(),
  status: z.enum(SEARCH_STATUSES),
});
export type CreateSearchResponse = z.infer<typeof CreateSearchResponse>;

export const SearchProgress = z.object({
  searchId: z.string(),
  status: z.enum(SEARCH_STATUSES),
  foundCount: z.number().int().nonnegative().default(0),
  leadsWithoutWebsite: z.number().int().nonnegative().default(0),
  enrichedCount: z.number().int().nonnegative().default(0),
  partialFailures: z.number().int().nonnegative().default(0),
  errorMessage: z.string().nullish(),
});
export type SearchProgress = z.infer<typeof SearchProgress>;

export const Pagination = z.object({
  cursor: z.string().nullish(),
  limit: z.number().int().positive().max(100).default(50),
});
export type Pagination = z.infer<typeof Pagination>;
