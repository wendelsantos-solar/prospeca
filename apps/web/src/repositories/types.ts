import type {
  Lead,
  LeadFilters,
  LeadNote,
  LeadActivity,
  LeadStage,
  Search,
  SavedSearch,
  CreateLeadNoteInput,
  CreateLeadActivityInput,
  RecordContactInput,
  DashboardPeriod,
} from "@/types";
import type { SortValue } from "@/lib/constants";
import type { CreateSearchInput, SearchStatusSnapshot, DiscoveryResult } from "@leads/contracts";
import type {
  EnrichmentSourceMap,
  SearchEstimate,
  SignalEvidence,
  TerritoryStats,
} from "@leads/domain";

export type { CreateSearchInput, SearchStatusSnapshot, DiscoveryResult };

/** Real pipeline rows for a mission (V3-B) — jobs under RLS. */
export interface MissionJobRow {
  placeId: string | null;
  type: string;
  status: string;
}

/** Per-place enrichment source states (V3-B). */
export interface MissionSourceRow {
  placeId: string;
  sources: EnrichmentSourceMap;
}

/** Raw timeline rows for one company (V3-E) — merged by the domain. */
export interface CompanyTimelineData {
  jobs: Array<{
    id: string;
    type: string;
    status: string;
    createdAt: string | null;
    finishedAt: string | null;
    error: string | null;
  }>;
  sources: Array<{
    id: string;
    provider: string;
    fetchedAt: string | null;
    error: string | null;
  }>;
  scores: Array<{
    id: string;
    calculatedAt: string | null;
    score: number | null;
    temperature: string | null;
    ruleVersion: string | null;
  }>;
  leadEvents: Array<{ id: string; type: string; label: string; detail?: string; at: string }>;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ListLeadsInput {
  filters: LeadFilters;
  page?: number;
  pageSize?: number;
  /** Same vocabulary the UI speaks (SORT_OPTIONS) — a bare string let the repo
   * silently ignore every value the store could produce. */
  sort?: SortValue;
}

export interface MoveLeadInput {
  toStage: LeadStage;
  closedValue?: number;
  closedService?: string;
  closedAt?: string;
  discardReason?: string;
  note?: string;
  /** Who closed the deal — free text, recorded on the "won" timeline event only. */
  owner?: string;
  /** Follow-up opportunity noted at close — recorded on the "won" timeline event only. */
  nextOpportunity?: string;
}

export type UpdateLeadInput = Partial<Omit<Lead, "id" | "notes" | "activities" | "timeline">>;

/** A persisted per-org V2 opportunity score (company_opportunity_scores row). */
export interface PersistedOpportunityScore {
  placeId: string;
  score: number;
  temperature: "hot" | "warm" | "cold";
  confidence: number;
  ruleVersion: string;
  calculatedAt: string;
  /** OpportunityScoreBreakdown persisted as JSON (components/reasons). */
  breakdown: unknown;
  /** Signal evidence array persisted by score-company (signal/severity/
   * evidence/confidence/source/derivedAt). Null on legacy rows. */
  signals?: SignalEvidence[] | null;
}

export interface DashboardOverview {
  totalLeads: number;
  byStage: Record<string, number>;
  byStageValue: Record<string, number>;
  byTemperature: Record<string, number>;
  byCity: Array<{
    city: string;
    count: number;
    won: number;
    qualified: number;
    contacted: number;
    revenue: number;
  }>;
  byCategory: Array<{
    category: string;
    count: number;
    won: number;
    qualified: number;
    contacted: number;
    revenue: number;
  }>;
  contacted: number;
  wonCount: number;
  wonValue: number;
  avgTicket: number;
  pipelineValue: number;
  avgDaysToClose: number;
  conversionRate: number;
  searchCount: number;
  importedCount: number;
  // ── Fase 4 (extensão da RPC — servidor, nunca array truncado) ──
  enrichedCount: number;
  respondedCount: number;
  meetingCount: number;
  proposalCount: number;
  discardedCount: number;
  pipelineCount: number;
  pipelineValueWindowed: number;
  channels: { whatsapp: number; phone: number; instagram: number; email: number; site: number };
  dailySeries: Array<{ date: string; leads: number; won: number; revenue: number }>;
  allTime: ValueProofAllTime;
}

export interface ValueProofAllTime {
  totalFound: number;
  withoutWebsite: number;
  noReviews: number;
  lowRating: number;
  hot: number;
  contacted: number;
  responded: number;
  meetings: number;
  proposals: number;
  won: number;
  revenue: number;
  cities: string[];
}

export interface OrganizationMember {
  userId: string;
  fullName: string | null;
  role: string;
  email: string;
}

/** Lead resolvido no servidor para ação em lote (subconjunto do Lead). */
export interface BulkResolvedLead {
  id: string;
  companyName: string;
  category: string;
  address: string;
  neighborhood: string | null;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  hasWebsite: boolean;
  rating: number | null;
  reviewCount: number | null;
  temperature: string;
  stage: string;
}

export interface LeadStageCounts {
  total: number;
  byStage: Record<string, number>;
}

export interface TodayCounts {
  today: number;
  overdue: number;
  firstReach: number;
}

/** Filtros que o export server-side aceita (espelho do contrato create-export). */
export interface ExportPipelineFilters {
  stages?: string[];
  temperatures?: string[];
  cities?: string[];
  categories?: string[];
  minScore?: number;
  maxScore?: number;
  minRating?: number;
  minReviews?: number;
  hasWebsite?: boolean;
  hasPhone?: boolean;
  hasWhatsapp?: boolean;
  hasEmail?: boolean;
  hasInstagram?: boolean;
  assignee?: string;
  discoveredAfter?: string;
  lastInteractionAfter?: string;
  valueMin?: number;
  valueMax?: number;
  search?: string;
}

export interface LeadRepository {
  list(input: ListLeadsInput): Promise<PaginatedResult<Lead>>;
  stageCounts(): Promise<LeadStageCounts>;
  todayCounts(): Promise<TodayCounts>;
  members(): Promise<OrganizationMember[]>;
  assignLead(leadId: string, userId: string | null): Promise<void>;
  /** Resolve IDs de leads no SERVIDOR (seleção em lote além das páginas em cache). */
  getLeadsByIds(ids: string[]): Promise<BulkResolvedLead[]>;
  exportPipeline(format: "csv" | "xlsx", filters: ExportPipelineFilters): Promise<Blob>;
  getById(id: string): Promise<Lead | null>;
  update(id: string, input: UpdateLeadInput): Promise<Lead>;
  moveStage(id: string, input: MoveLeadInput): Promise<Lead>;
  createNote(leadId: string, input: CreateLeadNoteInput): Promise<LeadNote>;
  updateNote(leadId: string, noteId: string, content: string): Promise<LeadNote>;
  removeNote(leadId: string, noteId: string): Promise<void>;
  toggleNotePin(leadId: string, noteId: string): Promise<LeadNote>;
  createActivity(leadId: string, input: CreateLeadActivityInput): Promise<LeadActivity>;
  /** Confirms a real commercial touch and atomically advances cadence state. */
  recordContact(leadId: string, input: RecordContactInput): Promise<LeadActivity>;
  completeActivity(leadId: string, activityId: string, done: boolean): Promise<LeadActivity>;
  updateActivity(
    leadId: string,
    activityId: string,
    input: Partial<Pick<LeadActivity, "title" | "note" | "date" | "priority" | "type">>,
  ): Promise<LeadActivity>;
  removeLead(id: string): Promise<void>;
  /** LGPD opt-out: value_hash set of suppressed contacts for the org. */
  listSuppressionHashes(): Promise<string[]>;
  addSuppression(entries: { type: string; value_hash: string; reason?: string }[]): Promise<void>;
}

export interface SearchRepository {
  create(
    input: CreateSearchInput,
    idempotencyKey?: string,
  ): Promise<{ searchId: string; estimate?: SearchEstimate | null }>;
  getStatus(searchId: string): Promise<SearchStatusSnapshot>;
  cancel(searchId: string): Promise<void>;
  listHistory(): Promise<Search[]>;
  importResults(
    searchId: string,
    placeIds: string[],
    importAll: boolean,
  ): Promise<{ imported: number; duplicates: number }>;
  getDiscovery(searchId: string): Promise<DiscoveryResult[]>;
  /** Register a search + its discovery results, created outside the
   * repository (demo mode's mock searchService). Real mode populates via
   * create(), so the Supabase implementation is a no-op.
   * Carries the full Search, not just its id (LOTE 4, Tarefa 2): saveSearch/
   * listSavedSearches need niche/location/radius/presence/createdAt to build
   * a SavedSearch, and searchService.run() is the only place that has them —
   * id-only left "salvar" a no-op for every search a real demo user actually
   * runs (registerDiscovery only cached results, never the search itself). */
  registerDiscovery(search: Search, results: DiscoveryResult[]): void;
  /** Enrich discovery contact fields via website scrape. No placeId → top-N by
   * score; with placeId → just that business (lazy, on-open). Best-effort. */
  enrichDiscovery(searchId: string, placeId?: string): Promise<{ enriched: number }>;
  addToFunnel(
    searchId: string,
    placeId: string,
    stage: "new" | "contacted",
  ): Promise<{ enrichableLeadIds: string[]; leadIds: string[] }>;
  enrichLead(leadId: string): Promise<void>;
  /** Mark a search as a saved "missão" (optionally named). Idempotent. */
  saveSearch(searchId: string, name: string): Promise<void>;
  /** Un-save a search. Idempotent. */
  unsaveSearch(searchId: string): Promise<void>;
  /** Saved searches with per-search opportunity stats. */
  listSavedSearches(): Promise<SavedSearch[]>;
  /** Persisted V2 opportunity score for one place (RLS). Null when not yet
   * computed — callers fall back to the client-side calculation. */
  getOpportunityScore(placeId: string): Promise<PersistedOpportunityScore | null>;
  /** Server-side territory aggregation for a search (territory_stats, RLS).
   * Empty until territory-analysis has run — callers fall back to client-side
   * aggregation over the loaded results. */
  listTerritoryStats(searchId: string): Promise<TerritoryStats[]>;
  /** Real pipeline data for a mission (V3-B): jobs rows + per-place
   * enrichment source states, all under RLS. Empty until the worker runs. */
  getMissionPipeline(
    searchId: string,
  ): Promise<{ jobs: MissionJobRow[]; sources: MissionSourceRow[] }>;
  /** Raw timeline rows for a company (V3-E): jobs, sources, scores and the
   * lead's commercial events — the domain merges them into one chronology. */
  getCompanyTimeline(placeId: string): Promise<CompanyTimelineData>;
}

export interface DashboardRepository {
  overview(period: DashboardPeriod, start: Date, end: Date): Promise<DashboardOverview>;
}
