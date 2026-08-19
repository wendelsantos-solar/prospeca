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
  /** Real job state for this place in the current search (V3-B): derived from
   * the jobs table when a non-terminal job exists. Null when idle. */
  pipelineState?: "queued" | "enriching" | "retrying" | null;
  /** Per-field enrichment state { email|instagram|whatsapp: {status, has} }.
   * A missing key means the field was never checked (pending). */
  enrichmentFields: Record<string, { status: string; has: boolean }> | null;
  /** Atividade econômica (CNAE) vinda do registro — persistida por lookup-cnpj
   * e servida pelo RPC de descoberta. Null enquanto o CNPJ não foi consultado:
   * ausência de consulta, não ausência de atividade. */
  primaryCnae: string | null;
  cnaeDescription: string | null;
  secondaryCnaes: string[] | null;
  /**
   * Decisores identificados nesta empresa (People Intelligence), agregados
   * para TRIAGEM.
   *
   * Contagem, banda e score — nunca o NOME. Para triar 60 resultados o
   * vendedor precisa saber ONDE existe um decisor forte, não quem ele é; o
   * nome aparece ao abrir a empresa, sob a mesma RLS. Assim o PII de sócio
   * não trafega em payload de listagem.
   *
   * Conta só relação VIGENTE e banda high/medium — o mesmo recorte de
   * pickPrimaryDecisionMaker. `0` significa "nenhum decisor sustentável",
   * o que inclui empresa sem CNPJ consultado.
   */
  decisionMakerCount: number;
  topDecisionMakerBand: "high" | "medium" | null;
  topDecisionMakerScore: number | null;
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

// ── Export ────────────────────────────────────────────────────────────

export const EXPORT_FORMATS = ["csv", "xlsx"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** Campos exportáveis de lead (lista fechada — campos desconhecidos são
 * REJEITADOS com 422, nunca silenciosamente ignorados). */
export const EXPORTABLE_LEAD_FIELDS = [
  "company_name",
  "category",
  "address",
  "neighborhood",
  "city",
  "state",
  "phone",
  "whatsapp",
  "email",
  "instagram",
  "website",
  "has_website",
  "rating",
  "review_count",
  "score",
  "temperature",
  "stage",
  "estimated_value",
  "closed_value",
  "created_at",
  "last_interaction_at",
] as const;
export type ExportableLeadField = (typeof EXPORTABLE_LEAD_FIELDS)[number];

export const CreateExportSchema = z
  .object({
    format: z.enum(EXPORT_FORMATS),
    /** Campos a exportar (V3-F). */
    fields: z.array(z.enum(EXPORTABLE_LEAD_FIELDS)).min(1).max(30).optional(),
    /** Retrocompat: alias de `fields` (versões antigas do cliente). */
    columns: z.array(z.string()).min(1).max(30).optional(),
    filters: z
      .object({
        stages: z.array(z.string()).optional(),
        temperatures: z.array(z.string()).optional(),
        cities: z.array(z.string()).optional(),
        categories: z.array(z.string()).optional(),
        minScore: z.number().optional(),
        // Fase 4.4 (retrocompat — tudo opcional): exportar "o que estou vendo"
        // com os filtros ativos da carteira.
        neighborhoods: z.array(z.string()).optional(),
        maxScore: z.number().optional(),
        minRating: z.number().optional(),
        minReviews: z.number().optional(),
        hasWebsite: z.boolean().optional(),
        hasPhone: z.boolean().optional(),
        hasWhatsapp: z.boolean().optional(),
        hasEmail: z.boolean().optional(),
        hasInstagram: z.boolean().optional(),
        assignee: z.string().uuid().nullable().optional(),
        discoveredAfter: z.string().optional(),
        lastInteractionAfter: z.string().optional(),
        valueMin: z.number().optional(),
        valueMax: z.number().optional(),
        search: z.string().max(200).optional(),
      })
      .default({}),
  })
  .refine((v) => v.fields || v.columns, { message: "fields ou columns é obrigatório." });

export type CreateExportInput = z.infer<typeof CreateExportSchema>;
