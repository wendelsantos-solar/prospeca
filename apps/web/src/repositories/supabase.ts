// Real repositories backed by Supabase (RLS enforced via user session).
import type {
  Lead,
  LeadNote,
  LeadActivity,
  Search,
  CreateLeadNoteInput,
  CreateLeadActivityInput,
  RecordContactInput,
  DashboardPeriod,
  TimelineEvent,
} from "@/types";
import { getSupabase, invokeFunction } from "@/lib/supabase";
import { resolveActiveOrganizationId } from "@/lib/tenant";
import { getStoredActiveOrganizationId } from "@/lib/active-organization";
import { parseAddress, type ScoreBreakdown } from "@leads/domain";
import type {
  CreateSearchInput,
  DashboardOverview,
  DashboardRepository,
  DiscoveryResult,
  LeadRepository,
  ListLeadsInput,
  MoveLeadInput,
  PaginatedResult,
  SearchRepository,
  SearchStatusSnapshot,
  UpdateLeadInput,
} from "./types";
import { STAGE_LABELS, type SortValue } from "@/lib/constants";
import { formatBRL } from "@/lib/format";

interface LeadRow {
  id: string;
  company_name: string;
  category: string | null;
  description: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  website: string | null;
  has_website: boolean;
  rating: number | null;
  review_count: number | null;
  score: number;
  score_breakdown: ScoreBreakdown | null;
  temperature: Lead["temperature"];
  stage: Lead["stage"];
  estimated_value: number | null;
  closed_value: number | null;
  closed_service: string | null;
  closed_at: string | null;
  discard_reason: string | null;
  last_interaction_at: string | null;
  cadence_started_at: string | null;
  cadence_step: number;
  cadence_completed_at: string | null;
  last_outcome: Lead["lastOutcome"] | null;
  responded_at: string | null;
  meeting_at: string | null;
  proposal_at: string | null;
  created_at: string;
  lead_notes?: NoteRow[];
  lead_activities?: ActivityRow[];
  lead_stage_history?: StageHistoryRow[];
}

interface StageHistoryRow {
  id: string;
  from_stage: string | null;
  to_stage: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

interface NoteRow {
  id: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

interface ActivityRow {
  id: string;
  type: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high";
  status: string;
  scheduled_at: string | null;
  completed_at: string | null;
  occurred_at: string | null;
  outcome: LeadActivity["outcome"] | null;
  cadence_step_id: string | null;
}

const ACTIVITY_TYPE_TO_UI: Record<string, LeadActivity["type"]> = {
  call: "call",
  whatsapp: "message",
  email: "message",
  meeting: "meeting",
  follow_up: "followup",
  proposal: "proposal",
  visit: "visit",
  other: "other",
};
const ACTIVITY_TYPE_TO_DB: Record<LeadActivity["type"], string> = {
  call: "call",
  message: "whatsapp",
  meeting: "meeting",
  followup: "follow_up",
  proposal: "proposal",
  visit: "visit",
  other: "other",
};

function mapNote(row: NoteRow): LeadNote {
  return {
    id: row.id,
    content: row.content,
    pinned: row.is_pinned,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapActivity(row: ActivityRow): LeadActivity {
  return {
    id: row.id,
    type: ACTIVITY_TYPE_TO_UI[row.type] ?? "other",
    title: row.title,
    note: row.description ?? undefined,
    priority: row.priority,
    done: row.status === "completed",
    date: row.scheduled_at ?? "",
    completedAt: row.completed_at ?? undefined,
    occurredAt: row.occurred_at ?? undefined,
    outcome: row.outcome ?? undefined,
    cadenceStepId: row.cadence_step_id ?? undefined,
  };
}

function stageLabel(stage: string): string {
  return STAGE_LABELS[stage as keyof typeof STAGE_LABELS] ?? stage;
}

function mapTimelineEvent(row: StageHistoryRow): TimelineEvent {
  const meta = row.metadata ?? {};
  const from = row.from_stage ? stageLabel(row.from_stage) : null;
  const to = stageLabel(row.to_stage);
  let label = from ? `${from} → ${to}` : `Movido para ${to}`;

  if (row.to_stage === "won") {
    const parts = [formatBRL(meta.closed_value as number | undefined)];
    if (meta.closed_service) parts.push(String(meta.closed_service));
    if (meta.owner) parts.push(`por ${meta.owner}`);
    label = `Negócio ganho — ${parts.join(" · ")}`;
  } else if (row.to_stage === "discarded" && meta.discard_reason) {
    label = `Descartado — ${meta.discard_reason}`;
  }
  if (meta.note) label += ` (${meta.note})`;
  if (meta.next_opportunity) label += ` — próxima oportunidade: ${meta.next_opportunity}`;

  return { id: row.id, kind: row.to_stage, label, at: row.created_at };
}

function mapLead(row: LeadRow): Lead {
  // `leads.address` holds the Google formatted address; neighborhood/city/state
  // are only populated for leads imported after the address parsing landed, so
  // older rows fall back to deriving them from the address string.
  const addr = parseAddress(row.address);
  return {
    id: row.id,
    companyName: row.company_name,
    category: row.category ?? "",
    description: row.description ?? undefined,
    address: row.address ?? "",
    neighborhood: row.neighborhood ?? addr.neighborhood ?? undefined,
    city: row.city ?? addr.city ?? "",
    state: row.state ?? addr.state ?? "",
    latitude: row.latitude ?? 0,
    longitude: row.longitude ?? 0,
    distanceKm: 0,
    phone: row.phone ?? undefined,
    whatsapp: row.whatsapp ?? undefined,
    email: row.email ?? undefined,
    instagram: row.instagram ?? undefined,
    website: row.website ?? undefined,
    hasWebsite: row.has_website,
    rating: row.rating ?? undefined,
    reviewCount: row.review_count ?? undefined,
    score: row.score,
    scoreBreakdown: row.score_breakdown ?? undefined,
    temperature: row.temperature,
    stage: row.stage,
    estimatedValue: row.estimated_value ?? undefined,
    closedValue: row.closed_value ?? undefined,
    closedService: row.closed_service ?? undefined,
    closedAt: row.closed_at ?? undefined,
    discardReason: row.discard_reason ?? undefined,
    lastInteractionAt: row.last_interaction_at ?? undefined,
    cadenceStartedAt: row.cadence_started_at ?? undefined,
    cadenceStep: row.cadence_step ?? 0,
    cadenceCompletedAt: row.cadence_completed_at ?? undefined,
    lastOutcome: row.last_outcome ?? undefined,
    respondedAt: row.responded_at ?? undefined,
    meetingAt: row.meeting_at ?? undefined,
    proposalAt: row.proposal_at ?? undefined,
    discoveredAt: row.created_at,
    notes: (row.lead_notes ?? []).map(mapNote),
    activities: (row.lead_activities ?? []).map(mapActivity),
    timeline: [...(row.lead_stage_history ?? [])]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(mapTimelineEvent),
  };
}

// Lean select for list views (Kanban, Painel, Hoje): omits nested notes/activities
// to cut payload by ~80%. Detail drawer fetches via getById with the full select.
// Lean select for list views (Kanban, Painel, Hoje, Agenda). Includes
// lead_activities so the Hoje/Agenda views can show scheduled calls,
// follow-ups etc. without a separate query per lead.
const LEAD_LIST_SELECT =
  "id, company_name, category, description, address, neighborhood, city, state, latitude, longitude, phone, whatsapp, email, instagram, website, has_website, rating, review_count, score, score_breakdown, temperature, stage, estimated_value, closed_value, closed_service, closed_at, discard_reason, last_interaction_at, cadence_started_at, cadence_step, cadence_completed_at, last_outcome, responded_at, meeting_at, proposal_at, created_at, lead_activities(*)";

const LEAD_DETAIL_SELECT =
  "*, lead_notes(*), lead_activities(*), lead_stage_history(id, from_stage, to_stage, created_at, metadata)";

/**
 * The UI's sort vocabulary → a `leads` column ordering. It used to switch on
 * "score" | "rating" | "name", which no caller can produce (the store speaks
 * SORT_OPTIONS), so every sort silently fell through to created_at — on a
 * 500-row page that meant "Maior score" ranked the newest rows, not the best.
 *
 * `relevance` mirrors the client ranking, which leads with score.
 * `distance-asc` has no column here: `distanceKm` is 0 for every funnel lead,
 * so it keeps the recency order rather than pretending to sort.
 */
const SORT_ORDER: Record<SortValue, { column: string; ascending: boolean } | null> = {
  relevance: { column: "score", ascending: false },
  "score-desc": { column: "score", ascending: false },
  "rating-desc": { column: "rating", ascending: false },
  "reviews-desc": { column: "review_count", ascending: false },
  "value-desc": { column: "estimated_value", ascending: false },
  recent: { column: "created_at", ascending: false },
  "name-asc": { column: "company_name", ascending: true },
  "name-desc": { column: "company_name", ascending: false },
  "distance-asc": null,
};

function applySort<
  Q extends { order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): Q },
>(query: Q, sort: SortValue | undefined): Q {
  const spec = sort ? SORT_ORDER[sort] : null;
  if (!spec) return query.order("created_at", { ascending: false });
  return query.order(spec.column, { ascending: spec.ascending, nullsFirst: false });
}

export class SupabaseLeadRepository implements LeadRepository {
  async list(input: ListLeadsInput): Promise<PaginatedResult<Lead>> {
    const supabase = getSupabase();
    const page = input.page ?? 1;
    const pageSize = Math.min(input.pageSize ?? 50, 500);
    const from = (page - 1) * pageSize;

    // Cumulative CRM leads (funnel). Discovery scoping moved to getDiscovery /
    // the get_search_discovery RPC — the map no longer reads from `leads`.
    let query = supabase
      .from("leads")
      .select(LEAD_LIST_SELECT, { count: "exact" })
      .range(from, from + pageSize - 1);

    const f = input.filters;
    if (f.stages?.length) query = query.in("stage", f.stages);
    if (f.temperatures?.length) query = query.in("temperature", f.temperatures);
    if (f.categories?.length) query = query.in("category", f.categories);
    if (f.cities?.length) query = query.in("city", f.cities);
    if (f.neighborhoods?.length) query = query.in("neighborhood", f.neighborhoods);
    if (f.minScore != null) query = query.gte("score", f.minScore);
    if (f.maxScore != null) query = query.lte("score", f.maxScore);
    if (f.minRating != null) query = query.gte("rating", f.minRating);
    if (f.minReviews != null) query = query.gte("review_count", f.minReviews);
    if (f.hasWebsite === true) query = query.eq("has_website", true);
    if (f.hasWebsite === false) query = query.eq("has_website", false);
    if (f.hasPhone) query = query.not("phone", "is", null);
    if (f.hasWhatsapp) query = query.not("whatsapp", "is", null);
    if (f.hasEmail) query = query.not("email", "is", null);
    if (f.hasInstagram) query = query.not("instagram", "is", null);
    if (f.discoveredAfter) query = query.gte("created_at", f.discoveredAfter);
    if (f.lastInteractionAfter) query = query.gte("last_interaction_at", f.lastInteractionAfter);
    if (f.valueMin != null) query = query.gte("estimated_value", f.valueMin);
    if (f.valueMax != null) query = query.lte("estimated_value", f.valueMax);

    query = applySort(query, input.sort);

    const { data, count, error } = await query;
    if (error) throw new Error(error.message);
    const items = (data as unknown as LeadRow[]).map(mapLead);
    return {
      items,
      total: count ?? items.length,
      page,
      pageSize,
      hasMore: from + items.length < (count ?? 0),
    };
  }

  async getById(id: string): Promise<Lead | null> {
    const { data, error } = await getSupabase()
      .from("leads")
      .select(LEAD_DETAIL_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapLead(data as unknown as LeadRow) : null;
  }

  async update(id: string, input: UpdateLeadInput): Promise<Lead> {
    const patch: Record<string, unknown> = {};
    if (input.companyName != null) patch.company_name = input.companyName;
    if (input.email !== undefined) patch.email = input.email;
    if (input.phone !== undefined) patch.phone = input.phone;
    if (input.whatsapp !== undefined) patch.whatsapp = input.whatsapp;
    if (input.instagram !== undefined) patch.instagram = input.instagram;
    if (input.website !== undefined) patch.website = input.website;
    if (input.estimatedValue !== undefined) patch.estimated_value = input.estimatedValue;
    if (input.description !== undefined) patch.description = input.description;

    const { data, error } = await getSupabase()
      .from("leads")
      .update(patch)
      .eq("id", id)
      .select(LEAD_DETAIL_SELECT)
      .single();
    if (error) throw new Error(error.message);
    return mapLead(data as unknown as LeadRow);
  }

  async moveStage(id: string, input: MoveLeadInput): Promise<Lead> {
    const { data, error } = await getSupabase().rpc("move_lead_stage", {
      p_lead_id: id,
      p_to_stage: input.toStage,
      p_metadata: {
        closed_value: input.closedValue,
        closed_service: input.closedService,
        closed_at: input.closedAt,
        discard_reason: input.discardReason,
        note: input.note,
        owner: input.owner,
        next_opportunity: input.nextOpportunity,
      },
    });
    if (error) throw new Error(error.message);
    const full = await this.getById((data as { id: string }).id);
    if (!full) throw new Error("Lead não encontrado após atualização.");
    return full;
  }

  async createNote(leadId: string, input: CreateLeadNoteInput): Promise<LeadNote> {
    const supabase = getSupabase();
    const { data: lead } = await supabase
      .from("leads")
      .select("organization_id")
      .eq("id", leadId)
      .single();
    const { data: user } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("lead_notes")
      .insert({
        lead_id: leadId,
        organization_id: lead?.organization_id,
        created_by: user.user?.id,
        content: input.content,
        is_pinned: input.pinned ?? false,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapNote(data as NoteRow);
  }

  async createActivity(leadId: string, input: CreateLeadActivityInput): Promise<LeadActivity> {
    const supabase = getSupabase();
    const { data: lead } = await supabase
      .from("leads")
      .select("organization_id")
      .eq("id", leadId)
      .single();
    const { data: user } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("lead_activities")
      .insert({
        lead_id: leadId,
        organization_id: lead?.organization_id,
        created_by: user.user?.id,
        type: ACTIVITY_TYPE_TO_DB[input.type] ?? "other",
        title: input.title,
        description: input.note ?? null,
        priority: input.priority ?? "medium",
        scheduled_at: input.date || null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapActivity(data as ActivityRow);
  }

  async recordContact(leadId: string, input: RecordContactInput): Promise<LeadActivity> {
    const { data, error } = await getSupabase().rpc("record_lead_contact", {
      p_lead_id: leadId,
      p_channel: input.channel,
      p_title: input.title,
      p_outcome: input.outcome,
      p_occurred_at: input.occurredAt,
      p_description: input.note ?? null,
      p_cadence_step_id: input.cadenceStepId ?? null,
    });
    if (error) throw new Error(error.message);
    return mapActivity(data as unknown as ActivityRow);
  }

  async completeActivity(leadId: string, activityId: string, done: boolean): Promise<LeadActivity> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("lead_activities")
      .update({
        status: done ? "completed" : "pending",
        completed_at: done ? new Date().toISOString() : null,
      })
      .eq("id", activityId)
      .eq("lead_id", leadId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapActivity(data as ActivityRow);
  }

  async updateActivity(
    leadId: string,
    activityId: string,
    input: Partial<Pick<LeadActivity, "title" | "note" | "date" | "priority" | "type">>,
  ): Promise<LeadActivity> {
    const supabase = getSupabase();
    const patch: Record<string, unknown> = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.note !== undefined) patch.description = input.note ?? null;
    if (input.date !== undefined) patch.scheduled_at = input.date || null;
    if (input.priority !== undefined) patch.priority = input.priority;
    if (input.type !== undefined) patch.type = ACTIVITY_TYPE_TO_DB[input.type] ?? "other";
    const { data, error } = await supabase
      .from("lead_activities")
      .update(patch)
      .eq("id", activityId)
      .eq("lead_id", leadId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapActivity(data as ActivityRow);
  }

  async updateNote(leadId: string, noteId: string, content: string): Promise<LeadNote> {
    const { data, error } = await getSupabase()
      .from("lead_notes")
      .update({ content, updated_at: new Date().toISOString() })
      .eq("id", noteId)
      .eq("lead_id", leadId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapNote(data as NoteRow);
  }

  async removeNote(leadId: string, noteId: string): Promise<void> {
    const { error } = await getSupabase()
      .from("lead_notes")
      .delete()
      .eq("id", noteId)
      .eq("lead_id", leadId);
    if (error) throw new Error(error.message);
  }

  async toggleNotePin(leadId: string, noteId: string): Promise<LeadNote> {
    const { data: current, error: fetchError } = await getSupabase()
      .from("lead_notes")
      .select("is_pinned")
      .eq("id", noteId)
      .eq("lead_id", leadId)
      .single();
    if (fetchError) throw new Error(fetchError.message);

    const { data, error } = await getSupabase()
      .from("lead_notes")
      .update({ is_pinned: !current.is_pinned, updated_at: new Date().toISOString() })
      .eq("id", noteId)
      .eq("lead_id", leadId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapNote(data as NoteRow);
  }

  async removeLead(id: string): Promise<void> {
    const { error } = await getSupabase().from("leads").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async listSuppressionHashes(): Promise<string[]> {
    // RLS scopes rows to the caller's organization(s).
    const { data, error } = await getSupabase().from("suppression_list").select("value_hash");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => r.value_hash as string);
  }

  async addSuppression(
    entries: { type: string; value_hash: string; reason?: string }[],
  ): Promise<void> {
    if (!entries.length) return;
    const supabase = getSupabase();
    const organizationId = await resolveActiveOrganizationId();
    const { error } = await supabase.from("suppression_list").upsert(
      entries.map((e) => ({
        organization_id: organizationId,
        type: e.type,
        value_hash: e.value_hash,
        reason: e.reason ?? null,
      })),
      { onConflict: "organization_id,type,value_hash" },
    );
    if (error) throw new Error(error.message);
  }
}

export class SupabaseSearchRepository implements SearchRepository {
  async create(input: CreateSearchInput, idempotencyKey?: string): Promise<{ searchId: string }> {
    return invokeFunction<{ searchId: string }>("create-search", input, { idempotencyKey });
  }

  async getStatus(searchId: string): Promise<SearchStatusSnapshot> {
    const raw = await invokeFunction<{
      id: string;
      status: SearchStatusSnapshot["status"];
      found_count: number;
      imported_count: number;
      enriched_count: number;
      provider_request_count: number;
      error_message: string | null;
    }>("get-search-status", { searchId });
    return {
      id: raw.id,
      status: raw.status,
      foundCount: raw.found_count,
      importedCount: raw.imported_count,
      enrichedCount: raw.enriched_count,
      providerRequestCount: raw.provider_request_count,
      errorMessage: raw.error_message,
    };
  }

  async cancel(searchId: string): Promise<void> {
    await invokeFunction("cancel-search", { searchId });
  }

  async listHistory(): Promise<Search[]> {
    const { data, error } = await getSupabase()
      .from("searches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: row.id,
      niche: row.query,
      location: row.location_label,
      latitude: row.center?.coordinates?.[1] ?? 0,
      longitude: row.center?.coordinates?.[0] ?? 0,
      radiusKm: row.radius_meters / 1000,
      presence:
        row.presence_filter === "without_website"
          ? ("no-website" as const)
          : row.presence_filter === "with_website"
            ? ("with-website" as const)
            : ("all" as const),
      createdAt: row.created_at,
      totalFound: row.found_count,
      enrichedCount: row.enriched_count,
      addedToPipeline: row.imported_count,
      contactsFound: row.enriched_count,
    }));
  }

  async importResults(
    searchId: string,
    placeIds: string[],
    importAll: boolean,
  ): Promise<{ imported: number; duplicates: number }> {
    return invokeFunction("import-search-results", { searchId, placeIds, importAll });
  }

  async getDiscovery(searchId: string): Promise<DiscoveryResult[]> {
    // Fast path: pass the organization_id directly so the RPC skips the
    // expensive is_organization_member() subquery on every call.
    const organizationId = getStoredActiveOrganizationId();
    const { data, error } = await getSupabase().rpc("get_search_discovery", {
      p_search_id: searchId,
      ...(organizationId ? { p_organization_id: organizationId } : {}),
    });
    if (error) throw new Error(error.message);
    return (data as Record<string, unknown>[]).map((r) => {
      // Google gives us a formatted string on the search path and structured
      // components only after a details refresh — parseAddress handles both.
      const addr = parseAddress(r.formatted_address as string | null, r.address_components);
      // The place itself may have no address at all (Google returned none, or
      // it was matched via Instagram rather than Places details). Fall back to
      // the location the search was run from — it's already fetched, free.
      // That label isn't a street address (it's "Bairro, Cidade" from reverse
      // geocoding, or a geocoded query like "Cidade - UF, Brasil"), so show it
      // as-is rather than running it through parseAddress's street-address rules.
      const searchLabel = ((r.search_location_label as string | null) ?? "")
        .replace(/,\s*(brazil|brasil)\s*$/i, "")
        .trim();
      return {
        placeId: r.place_id as string,
        name: r.name as string,
        category: (r.category as string) ?? null,
        latitude: r.latitude as number,
        longitude: r.longitude as number,
        address: addr.street,
        neighborhood: addr.neighborhood,
        city: addr.city ?? (searchLabel || null),
        state: addr.state,
        phone: (r.national_phone_number as string) ?? null,
        website: (r.website_uri as string) ?? null,
        hasWebsite: r.has_website as boolean,
        email: (r.email as string) ?? null,
        instagram: (r.instagram as string) ?? null,
        whatsapp: (r.whatsapp as string) ?? null,
        rating: (r.rating as number) ?? null,
        reviewCount: (r.review_count as number) ?? null,
        distanceKm: ((r.distance_meters as number) ?? 0) / 1000,
        score: (r.score as number) ?? 0,
        temperature: ((r.temperature as string) ?? "cold") as "hot" | "warm" | "cold",
        importedLeadId: (r.imported_lead_id as string) ?? null,
      };
    });
  }

  async enrichDiscovery(searchId: string, placeId?: string): Promise<{ enriched: number }> {
    return invokeFunction<{ enriched: number }>("enrich-discovery", {
      searchId,
      ...(placeId ? { placeId } : {}),
    });
  }

  async addToFunnel(
    searchId: string,
    placeId: string,
    stage: "new" | "contacted",
  ): Promise<{ enrichableLeadIds: string[]; leadIds: string[] }> {
    const res = await invokeFunction<{ enrichableLeadIds?: string[]; leadIds?: string[] }>(
      "import-search-results",
      {
        searchId,
        placeIds: [placeId],
        stage,
      },
    );
    return { enrichableLeadIds: res.enrichableLeadIds ?? [], leadIds: res.leadIds ?? [] };
  }

  async enrichLead(leadId: string): Promise<void> {
    await invokeFunction("enrich-lead", { leadId });
  }
}

export class SupabaseDashboardRepository implements DashboardRepository {
  async overview(_period: DashboardPeriod, start: Date, end: Date): Promise<DashboardOverview> {
    const supabase = getSupabase();
    const organizationId = await resolveActiveOrganizationId();

    const { data, error } = await supabase.rpc("get_dashboard_overview", {
      p_organization_id: organizationId,
      p_start_date: start.toISOString(),
      p_end_date: end.toISOString(),
    });
    if (error) throw new Error(error.message);
    return data as DashboardOverview;
  }
}
