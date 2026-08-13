import type { LeadStage, LeadTemperature, DashboardPeriod } from "@leads/contracts";
import type { ScoreBreakdown } from "@leads/domain";
export type { LeadStage, LeadTemperature, DashboardPeriod };
export { LEAD_STAGES, LEAD_TEMPERATURES, DASHBOARD_PERIODS } from "@leads/contracts";
export type LeadChannel = "phone" | "whatsapp" | "email" | "instagram" | "website";
export type PresenceFilter = "no-website" | "with-website" | "all";
export type ActivityType =
  | "call"
  | "message"
  | "meeting"
  | "followup"
  | "proposal"
  | "visit"
  | "other";
export type ContactChannel = "whatsapp" | "call" | "email";
export type ContactOutcome =
  | "sent"
  | "answered"
  | "no_answer"
  | "meeting"
  | "proposal"
  | "won"
  | "lost";

export interface LeadNote {
  id: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  pinned?: boolean;
}

export interface LeadActivity {
  id: string;
  type: ActivityType;
  title: string;
  /** ISO instant used for sorting, notifications and external calendars. */
  date: string;
  time?: string;
  scheduledEndAt?: string;
  timezone?: string;
  attendeeEmail?: string;
  calendarEvent?: {
    htmlUrl?: string;
    meetingUrl?: string;
    status: "pending" | "confirmed" | "cancelled" | "error";
  };
  note?: string;
  priority?: "low" | "medium" | "high";
  done?: boolean;
  completedAt?: string;
  occurredAt?: string;
  outcome?: ContactOutcome;
  cadenceStepId?: string;
}

export interface RecordContactInput {
  channel: ContactChannel;
  title: string;
  outcome: ContactOutcome;
  occurredAt: string;
  note?: string;
  cadenceStepId?: string;
}

export interface TimelineEvent {
  id: string;
  kind: string;
  label: string;
  at: string;
}

export interface Lead {
  id: string;
  companyName: string;
  category: string;
  description?: string;
  address: string;
  neighborhood?: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  phone?: string;
  whatsapp?: string;
  email?: string;
  instagram?: string;
  website?: string;
  hasWebsite: boolean;
  /** Discovery preview only: enrichment lifecycle + per-field state, used to
   * distinguish "não possui/não encontrado" from "ainda não verificado". */
  enrichmentState?: "pending" | "processing" | "enriched" | "partial" | "failed";
  enrichmentFields?: Record<string, { status: string; has: boolean }> | null;
  rating?: number;
  reviewCount?: number;
  score: number;
  scoreBreakdown?: ScoreBreakdown;
  temperature: LeadTemperature;
  stage: LeadStage;
  estimatedValue?: number;
  closedValue?: number;
  closedService?: string;
  closedAt?: string;
  discardReason?: string;
  lastInteractionAt?: string;
  cadenceStartedAt?: string;
  cadenceStep?: number;
  cadenceCompletedAt?: string;
  lastOutcome?: ContactOutcome;
  respondedAt?: string;
  meetingAt?: string;
  proposalAt?: string;
  discoveredAt: string;
  openingHours?: string[];
  nextActivity?: LeadActivity;
  notes: LeadNote[];
  activities: LeadActivity[];
  timeline: TimelineEvent[];
}

export interface Search {
  id: string;
  niche: string;
  location: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  presence: PresenceFilter;
  createdAt: string;
  totalFound: number;
  enrichedCount: number;
  addedToPipeline: number;
  contactsFound: number;
}

/** A search the user explicitly saved as a reusable "missão", with per-search
 * opportunity stats derived from its persisted results. */
export interface SavedSearch {
  searchId: string;
  query: string;
  category: string | null;
  locationLabel: string;
  radiusMeters: number;
  presenceFilter: "without_website" | "with_website" | "all";
  status: string;
  foundCount: number;
  importedCount: number;
  createdAt: string;
  savedName: string | null;
  latitude: number;
  longitude: number;
  totalResults: number;
  hotCount: number;
  avgScore: number;
  withoutWebsite: number;
}

export interface SearchProgress {
  step: number;
  stepLabel: string;
  percent: number;
  partialCount: number;
  cancelled?: boolean;
}

export interface LeadFilters {
  quick: string[];
  minRating?: number;
  minReviews?: number;
  maxDistance?: number;
  minScore?: number;
  maxScore?: number;
  hasPhone?: boolean;
  hasWhatsapp?: boolean;
  hasInstagram?: boolean;
  hasEmail?: boolean;
  hasWebsite?: boolean | null;
  temperatures?: LeadTemperature[];
  stages?: LeadStage[];
  categories?: string[];
  cities?: string[];
  neighborhoods?: string[];
  valueMin?: number;
  valueMax?: number;
  discoveredAfter?: string;
  lastInteractionAfter?: string;
  onlyUncontacted?: boolean;
  onlyWithTask?: boolean;
}

export interface MessageTemplate {
  name: string;
  content: string;
}

export interface SavedFilter {
  id: string;
  name: string;
  filters: LeadFilters;
}

export type SearchHistory = Search[];

export type ExportFormat = "csv" | "excel";

export type DiscardReason =
  | "Sem interesse"
  | "Contato inválido"
  | "Empresa encerrada"
  | "Já possui fornecedor"
  | "Fora do perfil"
  | "Sem resposta"
  | "Duplicado"
  | "Outro";

export interface WonDeal {
  leadId: string;
  value: number;
  service: string;
  closedAt: string;
  owner?: string;
  note?: string;
  nextOpportunity?: string;
}

export interface PipelineStage {
  stage: LeadStage;
  label: string;
  count: number;
  value: number;
}

export interface AnalyticsMetric {
  label: string;
  value: string;
  delta?: number;
  tooltip?: string;
}

export type CreateLeadNoteInput = Omit<LeadNote, "id" | "createdAt">;
export type CreateLeadActivityInput = Omit<LeadActivity, "id">;
