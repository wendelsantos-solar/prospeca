// Shared Zod schemas for the API boundary between frontend and edge functions.
// A single source of truth for validation on both sides.
import { z } from "zod";

// ── Search ────────────────────────────────────────────────────────────

export const SearchLocationSchema = z.object({
  label: z.string().min(2).max(200),
  placeId: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export type SearchLocation = z.infer<typeof SearchLocationSchema>;

export const CreateSearchInputSchema = z.object({
  query: z.string().min(2).max(120),
  category: z.string().max(80).optional(),
  location: SearchLocationSchema,
  radiusMeters: z.number().int().min(100).max(100_000),
  presenceFilter: z.enum(["without_website", "with_website", "all"]),
  maxResults: z.number().int().min(1).max(500).optional(),
  forceRefresh: z.boolean().optional(),
});

export type CreateSearchInput = z.infer<typeof CreateSearchInputSchema>;

// ── Search status ─────────────────────────────────────────────────────

export const SEARCH_STATUSES = [
  "queued",
  "geocoding",
  "searching",
  "importing",
  "enriching",
  "completed",
  "partial",
  "failed",
  "cancelled",
] as const;

export type SearchStatus = (typeof SEARCH_STATUSES)[number];

export interface SearchStatusSnapshot {
  id: string;
  status: SearchStatus;
  foundCount: number;
  importedCount: number;
  enrichedCount: number;
  providerRequestCount: number;
  /** Pre-flight cost estimate (USD, range max) persisted by create-search. */
  estimatedCostUsd?: number | null;
  estimatedResults?: number | null;
  errorMessage?: string | null;
}

// ── Import ────────────────────────────────────────────────────────────

export const ImportSearchResultsSchema = z.object({
  searchId: z.string().uuid(),
  placeIds: z.array(z.string().uuid()).max(200).default([]),
  importAll: z.boolean().default(false),
  stage: z.enum(["new", "qualified", "contacted"]).default("new"),
});

export type ImportSearchResultsInput = z.infer<typeof ImportSearchResultsSchema>;

// ── Discovery ─────────────────────────────────────────────────────────

export interface DiscoveryResult {
  placeId: string;
  name: string;
  category: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  website: string | null;
  hasWebsite: boolean;
  email: string | null;
  instagram: string | null;
  whatsapp: string | null;
  rating: number | null;
  reviewCount: number | null;
  distanceKm: number;
  /** Single display source for the discovery list: search_results.score holds
   * the V2 opportunity score written by score-company (RPC get_search_discovery
   * serves it unchanged). The funnel (leads.score) stays v3.0.0. */
  score: number;
  temperature: "hot" | "warm" | "cold";
  importedLeadId: string | null;
  /** V2 score confidence (0..1) from company_opportunity_scores — metadata only
   * (the RPC does not expose it); null until score-company has scored the place.
   * Drives the LOW/MEDIUM/HIGH confidence band badge in the list. */
  opportunityConfidence?: number | null;
  /** Overall enrichment lifecycle for this business (pending | processing |
   * enriched | partial | failed). Drives the "ainda não verificamos" vs
   * "não possui" distinction in the UI. */
  enrichmentState: "pending" | "processing" | "enriched" | "partial" | "failed";
  /** Per-field enrichment state { email|instagram|whatsapp: {status, has} }.
   * A missing key means the field was never checked (pending). */
  enrichmentFields: Record<string, { status: string; has: boolean }> | null;
}

// ── Lead stages & temperatures ────────────────────────────────────────

export const LEAD_STAGES = ["new", "qualified", "contacted", "won", "discarded"] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_TEMPERATURES = ["hot", "warm", "cold"] as const;

export type LeadTemperature = (typeof LEAD_TEMPERATURES)[number];

// ── Dashboard ─────────────────────────────────────────────────────────

export const DASHBOARD_PERIODS = ["today", "7d", "30d", "90d", "year", "custom"] as const;

export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

// ── Feedback ──────────────────────────────────────────────────────────

export const FeedbackInputSchema = z.object({
  type: z.enum(["bug", "feature", "improvement", "other"]),
  message: z.string().min(10).max(4000),
  pageUrl: z.string().optional(),
});

export type FeedbackInput = z.infer<typeof FeedbackInputSchema>;

// ── Organization budget ───────────────────────────────────────────────

export const SetOrgBudgetSchema = z.object({
  organizationId: z.string().uuid(),
  monthlyBudgetCents: z.number().int().min(0).nullable(),
});

export type SetOrgBudgetInput = z.infer<typeof SetOrgBudgetSchema>;

// ── Lead enrichment ───────────────────────────────────────────────────

export const EnrichDiscoverySchema = z.object({
  searchId: z.string().uuid(),
  placeId: z.string().uuid().optional(),
});

export type EnrichDiscoveryInput = z.infer<typeof EnrichDiscoverySchema>;

// ── Account deletion (LGPD/GDPR) ──────────────────────────────────────

export const DeleteAccountSchema = z.object({
  userId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
});

export type DeleteAccountInput = z.infer<typeof DeleteAccountSchema>;
