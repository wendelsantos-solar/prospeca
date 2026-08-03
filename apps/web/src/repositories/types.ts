import type {
  Lead,
  LeadFilters,
  LeadNote,
  LeadActivity,
  LeadStage,
  Search,
  CreateLeadNoteInput,
  CreateLeadActivityInput,
  RecordContactInput,
  DashboardPeriod,
} from "@/types";
import type { SortValue } from "@/lib/constants";
import type { CreateSearchInput, SearchStatusSnapshot, DiscoveryResult } from "@leads/contracts";

export type { CreateSearchInput, SearchStatusSnapshot, DiscoveryResult };

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
}

export type UpdateLeadInput = Partial<Omit<Lead, "id" | "notes" | "activities" | "timeline">>;

export interface DashboardOverview {
  totalLeads: number;
  byStage: Record<string, number>;
  byTemperature: Record<string, number>;
  byCity: Array<{ city: string; count: number; won: number }>;
  byCategory: Array<{ category: string; count: number; won: number }>;
  contacted: number;
  wonCount: number;
  wonValue: number;
  avgTicket: number;
  pipelineValue: number;
  avgDaysToClose: number;
  conversionRate: number;
  searchCount: number;
  importedCount: number;
}

export interface LeadRepository {
  list(input: ListLeadsInput): Promise<PaginatedResult<Lead>>;
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
  create(input: CreateSearchInput, idempotencyKey?: string): Promise<{ searchId: string }>;
  getStatus(searchId: string): Promise<SearchStatusSnapshot>;
  cancel(searchId: string): Promise<void>;
  listHistory(): Promise<Search[]>;
  importResults(
    searchId: string,
    placeIds: string[],
    importAll: boolean,
  ): Promise<{ imported: number; duplicates: number }>;
  getDiscovery(searchId: string): Promise<DiscoveryResult[]>;
  /** Enrich discovery contact fields via website scrape. No placeId → top-N by
   * score; with placeId → just that business (lazy, on-open). Best-effort. */
  enrichDiscovery(searchId: string, placeId?: string): Promise<{ enriched: number }>;
  addToFunnel(
    searchId: string,
    placeId: string,
    stage: "new" | "contacted",
  ): Promise<{ enrichableLeadIds: string[]; leadIds: string[] }>;
  enrichLead(leadId: string): Promise<void>;
}

export interface DashboardRepository {
  overview(period: DashboardPeriod, start: Date, end: Date): Promise<DashboardOverview>;
}
