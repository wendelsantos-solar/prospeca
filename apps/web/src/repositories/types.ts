import type {
  Lead,
  LeadFilters,
  LeadNote,
  LeadActivity,
  LeadStage,
  Search,
  CreateLeadNoteInput,
  CreateLeadActivityInput,
  DashboardPeriod,
} from "@/types";

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
  sort?: string;
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

export interface CreateSearchInput {
  query: string;
  category?: string;
  location: {
    label: string;
    placeId?: string;
    latitude?: number;
    longitude?: number;
  };
  radiusMeters: number;
  presenceFilter: "without_website" | "with_website" | "all";
  maxResults?: number;
}

export interface SearchStatusSnapshot {
  id: string;
  status:
    | "queued"
    | "geocoding"
    | "searching"
    | "importing"
    | "enriching"
    | "completed"
    | "partial"
    | "failed"
    | "cancelled";
  foundCount: number;
  importedCount: number;
  enrichedCount: number;
  providerRequestCount: number;
  errorMessage?: string | null;
}

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
  removeLead(id: string): Promise<void>;
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
}

export interface DashboardRepository {
  overview(period: DashboardPeriod, start: Date, end: Date): Promise<DashboardOverview>;
}
