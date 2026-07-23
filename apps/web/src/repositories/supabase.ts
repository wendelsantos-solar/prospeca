// Real repositories backed by Supabase (RLS enforced via user session).
import type {
  Lead,
  LeadNote,
  LeadActivity,
  Search,
  CreateLeadNoteInput,
  CreateLeadActivityInput,
  DashboardPeriod,
} from "@/types";
import { getSupabase, invokeFunction } from "@/lib/supabase";
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
  temperature: Lead["temperature"];
  stage: Lead["stage"];
  estimated_value: number | null;
  closed_value: number | null;
  closed_service: string | null;
  closed_at: string | null;
  discard_reason: string | null;
  last_interaction_at: string | null;
  created_at: string;
  lead_notes?: NoteRow[];
  lead_activities?: ActivityRow[];
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
  };
}

function mapLead(row: LeadRow): Lead {
  return {
    id: row.id,
    companyName: row.company_name,
    category: row.category ?? "",
    description: row.description ?? undefined,
    address: row.address ?? "",
    neighborhood: row.neighborhood ?? undefined,
    city: row.city ?? "",
    state: row.state ?? "",
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
    temperature: row.temperature,
    stage: row.stage,
    estimatedValue: row.estimated_value ?? undefined,
    closedValue: row.closed_value ?? undefined,
    closedService: row.closed_service ?? undefined,
    closedAt: row.closed_at ?? undefined,
    discardReason: row.discard_reason ?? undefined,
    lastInteractionAt: row.last_interaction_at ?? undefined,
    discoveredAt: row.created_at,
    notes: (row.lead_notes ?? []).map(mapNote),
    activities: (row.lead_activities ?? []).map(mapActivity),
    timeline: [],
  };
}

const LEAD_SELECT = "*, lead_notes(*), lead_activities(*)";

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
      .select(LEAD_SELECT, { count: "exact" })
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

    switch (input.sort) {
      case "score":
        query = query.order("score", { ascending: false });
        break;
      case "rating":
        query = query.order("rating", { ascending: false, nullsFirst: false });
        break;
      case "name":
        query = query.order("company_name", { ascending: true });
        break;
      default:
        query = query.order("created_at", { ascending: false });
    }

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
      .select(LEAD_SELECT)
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
      .select(LEAD_SELECT)
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
    const { data, error } = await getSupabase().rpc("get_search_discovery", {
      p_search_id: searchId,
    });
    if (error) throw new Error(error.message);
    return (data as Record<string, unknown>[]).map((r) => ({
      placeId: r.place_id as string,
      name: r.name as string,
      category: (r.category as string) ?? null,
      latitude: r.latitude as number,
      longitude: r.longitude as number,
      phone: (r.national_phone_number as string) ?? null,
      website: (r.website_uri as string) ?? null,
      hasWebsite: r.has_website as boolean,
      rating: (r.rating as number) ?? null,
      reviewCount: (r.review_count as number) ?? null,
      distanceKm: ((r.distance_meters as number) ?? 0) / 1000,
      score: (r.score as number) ?? 0,
      temperature: ((r.temperature as string) ?? "cold") as "hot" | "warm" | "cold",
      importedLeadId: (r.imported_lead_id as string) ?? null,
    }));
  }

  async addToFunnel(
    searchId: string,
    placeId: string,
    stage: "new" | "contacted",
  ): Promise<{ enrichableLeadIds: string[] }> {
    const res = await invokeFunction<{ enrichableLeadIds?: string[] }>("import-search-results", {
      searchId,
      placeIds: [placeId],
      stage,
    });
    return { enrichableLeadIds: res.enrichableLeadIds ?? [] };
  }

  async enrichLead(leadId: string): Promise<void> {
    await invokeFunction("enrich-lead", { leadId });
  }
}

export class SupabaseDashboardRepository implements DashboardRepository {
  async overview(_period: DashboardPeriod, start: Date, end: Date): Promise<DashboardOverview> {
    const supabase = getSupabase();
    const { data: memberships } = await supabase
      .from("organization_members")
      .select("organization_id")
      .limit(1);
    const organizationId = memberships?.[0]?.organization_id;
    if (!organizationId) throw new Error("Organização não encontrada.");

    const { data, error } = await supabase.rpc("get_dashboard_overview", {
      p_organization_id: organizationId,
      p_start_date: start.toISOString(),
      p_end_date: end.toISOString(),
    });
    if (error) throw new Error(error.message);
    return data as DashboardOverview;
  }
}
