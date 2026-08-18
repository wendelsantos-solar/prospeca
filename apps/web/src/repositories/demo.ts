// Demo repositories — explicit demo mode only (VITE_DATA_MODE=demo).
// Never used as silent fallback in production.
import type {
  Lead,
  LeadNote,
  LeadActivity,
  Search,
  SavedSearch,
  CreateLeadNoteInput,
  CreateLeadActivityInput,
  RecordContactInput,
  DashboardPeriod,
} from "@/types";
import { MOCK_LEADS } from "@/mocks/leads";
import { applyFilters } from "@/lib/filters";
import type {
  BulkResolvedLead,
  CompanyTimelineData,
  CreateSearchInput,
  DashboardOverview,
  DashboardRepository,
  DiscoveryResult,
  ExportPipelineFilters,
  LeadRepository,
  LeadStageCounts,
  ListLeadsInput,
  MissionJobRow,
  MissionSourceRow,
  MoveLeadInput,
  OrganizationMember,
  PaginatedResult,
  PersistedOpportunityScore,
  SearchRepository,
  SearchStatusSnapshot,
  TodayCounts,
  UpdateLeadInput,
} from "./types";
import type { TerritoryStats } from "@leads/domain";
import type { SearchEstimate } from "@leads/domain";

let demoLeads: Lead[] = [...MOCK_LEADS];
const demoSearches: Search[] = [];

/**
 * Seed do repositório demo a partir do store. MERGE POR ID (upsert), não
 * substituição: com a paginação da Fase 4 o store passou a conter UMA PÁGINA
 * (50 de 82) e a substituição apagava leads fora da página + revertia mutações
 * locais (P2 da 4d). Existentes são PRESERVADOS (mutação local vence);
 * entradas novas são adicionadas. Reset explícito: resetDemoLeads.
 */
export function seedDemoLeads(leads: Lead[]) {
  const byId = new Map(demoLeads.map((l) => [l.id, l]));
  for (const incoming of leads) {
    if (!byId.has(incoming.id)) byId.set(incoming.id, incoming);
  }
  demoLeads = [...byId.values()];
}

/** Caminho legítimo e EXPLÍCITO para descartar mutações locais (reset demo). */
export function resetDemoLeads(next: Lead[]) {
  demoLeads = [...next];
}

export class DemoLeadRepository implements LeadRepository {
  async stageCounts(): Promise<LeadStageCounts> {
    const byStage: Record<string, number> = {};
    for (const l of demoLeads) byStage[l.stage] = (byStage[l.stage] ?? 0) + 1;
    return { total: demoLeads.length, byStage };
  }

  async todayCounts(): Promise<TodayCounts> {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    let today = 0;
    let overdue = 0;
    let firstReach = 0;
    for (const l of demoLeads) {
      if (l.stage === "won" || l.stage === "discarded") continue;
      const open = l.activities.filter((a) => a.date && !a.done);
      let hasScheduled = false;
      for (const a of open) {
        hasScheduled = true;
        const due = new Date(a.date!);
        if (due < todayStart) overdue++;
        else if (due <= todayEnd) today++;
      }
      if (!hasScheduled && l.stage === "new" && !l.lastInteractionAt) firstReach++;
    }
    return { today, overdue, firstReach };
  }

  async exportPipeline(format: "csv" | "xlsx", _filters: ExportPipelineFilters): Promise<Blob> {
    // Demo coerente: CSV client-side (sem backend), como o resto do modo demo.
    const header = "Empresa;Cidade;Estágio";
    const lines = demoLeads.map((l) => `${l.companyName};${l.city};${l.stage}`);
    return new Blob(["﻿" + [header, ...lines].join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
  }

  async members(): Promise<OrganizationMember[]> {
    return [];
  }

  async assignLead(leadId: string, userId: string | null): Promise<void> {
    demoLeads = demoLeads.map((l) =>
      l.id === leadId ? { ...l, assignedTo: userId ?? undefined } : l,
    );
  }

  async getLeadsByIds(ids: string[]): Promise<BulkResolvedLead[]> {
    return demoLeads
      .filter((l) => ids.includes(l.id))
      .map((l) => ({
        id: l.id,
        companyName: l.companyName,
        category: l.category,
        address: l.address,
        neighborhood: l.neighborhood ?? null,
        city: l.city,
        state: l.state,
        latitude: l.latitude,
        longitude: l.longitude,
        phone: l.phone ?? null,
        whatsapp: l.whatsapp ?? null,
        email: l.email ?? null,
        instagram: l.instagram ?? null,
        hasWebsite: l.hasWebsite,
        rating: l.rating ?? null,
        reviewCount: l.reviewCount ?? null,
        temperature: l.temperature,
        stage: l.stage,
      }));
  }

  async list(input: ListLeadsInput): Promise<PaginatedResult<Lead>> {
    const filtered = applyFilters(demoLeads, input.filters);
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? 50;
    const start = (page - 1) * pageSize;
    return {
      items: filtered.slice(start, start + pageSize),
      total: filtered.length,
      page,
      pageSize,
      hasMore: start + pageSize < filtered.length,
    };
  }

  async getById(id: string): Promise<Lead | null> {
    return demoLeads.find((l) => l.id === id) ?? null;
  }

  async update(id: string, input: UpdateLeadInput): Promise<Lead> {
    demoLeads = demoLeads.map((l) => (l.id === id ? { ...l, ...input } : l));
    const lead = demoLeads.find((l) => l.id === id);
    if (!lead) throw new Error("Lead não encontrado.");
    return lead;
  }

  async moveStage(id: string, input: MoveLeadInput): Promise<Lead> {
    return this.update(id, {
      stage: input.toStage,
      closedValue: input.closedValue,
      closedService: input.closedService,
      closedAt: input.closedAt,
      discardReason: input.discardReason,
    });
  }

  async createNote(leadId: string, input: CreateLeadNoteInput): Promise<LeadNote> {
    const note: LeadNote = {
      id: `note-${Date.now()}`,
      content: input.content,
      pinned: input.pinned,
      createdAt: new Date().toISOString(),
    };
    demoLeads = demoLeads.map((l) => (l.id === leadId ? { ...l, notes: [note, ...l.notes] } : l));
    return note;
  }

  async createActivity(leadId: string, input: CreateLeadActivityInput): Promise<LeadActivity> {
    const activity: LeadActivity = { id: `act-${Date.now()}`, ...input };
    demoLeads = demoLeads.map((l) =>
      l.id === leadId ? { ...l, activities: [activity, ...l.activities] } : l,
    );
    return activity;
  }

  async recordContact(leadId: string, input: RecordContactInput): Promise<LeadActivity> {
    const stepOrder: Record<string, number> = {
      "followup-1": 1,
      "call-1": 2,
      "followup-2": 3,
      "last-attempt": 4,
    };
    const activity: LeadActivity = {
      id: `contact-${Date.now()}`,
      type: input.channel === "whatsapp" || input.channel === "email" ? "message" : "call",
      title: input.title,
      note: input.note,
      date: input.occurredAt,
      occurredAt: input.occurredAt,
      completedAt: input.occurredAt,
      done: true,
      outcome: input.outcome,
      cadenceStepId: input.cadenceStepId,
    };
    let found = false;
    demoLeads = demoLeads.map((lead) => {
      if (lead.id !== leadId) return lead;
      found = true;
      const nextStep = input.cadenceStepId ? (stepOrder[input.cadenceStepId] ?? 0) : 0;
      const cadenceStep = Math.max(lead.cadenceStep ?? 0, nextStep);
      const cadenceSucceeded = ["answered", "meeting", "proposal", "won"].includes(input.outcome);
      return {
        ...lead,
        stage: lead.stage === "won" || lead.stage === "discarded" ? lead.stage : "contacted",
        lastInteractionAt: input.occurredAt,
        cadenceStartedAt: lead.cadenceStartedAt ?? input.occurredAt,
        cadenceStep,
        cadenceCompletedAt:
          cadenceStep >= 4 || cadenceSucceeded ? input.occurredAt : lead.cadenceCompletedAt,
        lastOutcome: input.outcome,
        respondedAt: input.outcome === "answered" ? input.occurredAt : lead.respondedAt,
        meetingAt: input.outcome === "meeting" ? input.occurredAt : lead.meetingAt,
        proposalAt: input.outcome === "proposal" ? input.occurredAt : lead.proposalAt,
        activities: [activity, ...lead.activities],
      };
    });
    if (!found) throw new Error("Lead não encontrado.");
    return activity;
  }

  async completeActivity(leadId: string, activityId: string, done: boolean): Promise<LeadActivity> {
    let updated: LeadActivity | undefined;
    demoLeads = demoLeads.map((l) => {
      if (l.id !== leadId) return l;
      const activities = l.activities.map((a) => {
        if (a.id === activityId) {
          updated = { ...a, done, completedAt: done ? new Date().toISOString() : undefined };
          return updated;
        }
        return a;
      });
      return { ...l, activities };
    });
    if (!updated) throw new Error("Atividade não encontrada.");
    return updated;
  }

  async updateActivity(
    leadId: string,
    activityId: string,
    input: Partial<Pick<LeadActivity, "title" | "note" | "date" | "priority" | "type">>,
  ): Promise<LeadActivity> {
    let updated: LeadActivity | undefined;
    demoLeads = demoLeads.map((l) => {
      if (l.id !== leadId) return l;
      const activities = l.activities.map((a) => {
        if (a.id === activityId) {
          updated = { ...a, ...input };
          return updated;
        }
        return a;
      });
      return { ...l, activities };
    });
    if (!updated) throw new Error("Atividade não encontrada.");
    return updated;
  }

  async updateNote(leadId: string, noteId: string, content: string): Promise<LeadNote> {
    let updated: LeadNote | undefined;
    demoLeads = demoLeads.map((l) => {
      if (l.id !== leadId) return l;
      const notes = l.notes.map((n) => {
        if (n.id === noteId) {
          updated = { ...n, content, updatedAt: new Date().toISOString() };
          return updated;
        }
        return n;
      });
      return { ...l, notes };
    });
    if (!updated) throw new Error("Nota não encontrada.");
    return updated;
  }

  async removeNote(leadId: string, noteId: string): Promise<void> {
    demoLeads = demoLeads.map((l) =>
      l.id === leadId ? { ...l, notes: l.notes.filter((n) => n.id !== noteId) } : l,
    );
  }

  async toggleNotePin(leadId: string, noteId: string): Promise<LeadNote> {
    let updated: LeadNote | undefined;
    demoLeads = demoLeads.map((l) => {
      if (l.id !== leadId) return l;
      const notes = l.notes.map((n) => {
        if (n.id === noteId) {
          updated = { ...n, pinned: !n.pinned };
          return updated;
        }
        return n;
      });
      return { ...l, notes };
    });
    if (!updated) throw new Error("Nota não encontrada.");
    return updated;
  }

  async removeLead(id: string): Promise<void> {
    demoLeads = demoLeads.filter((l) => l.id !== id);
  }

  async listSuppressionHashes(): Promise<string[]> {
    return [];
  }

  async addSuppression(): Promise<void> {
    // no-op no modo demo.
  }
}

export class DemoSearchRepository implements SearchRepository {
  // Map searchId → discovery results so the sidebar list + map stay populated.
  private discoveryCache = new Map<string, DiscoveryResult[]>();

  async create(
    input: CreateSearchInput,
    _idempotencyKey?: string,
  ): Promise<{ searchId: string; estimate?: SearchEstimate | null }> {
    const id = `demo-search-${Date.now()}`;

    // Build discovery results from mock leads — same data the service returns
    // so the sidebar (useDiscoveryResults) is populated, not just Zustand.
    const presence =
      input.presenceFilter === "without_website"
        ? "no-website"
        : input.presenceFilter === "with_website"
          ? "with-website"
          : "all";
    const nicheLower = input.query.toLowerCase();
    const results: DiscoveryResult[] = MOCK_LEADS.filter((l) =>
      presence === "no-website" ? !l.hasWebsite : presence === "with-website" ? l.hasWebsite : true,
    )
      .filter(
        (l) =>
          l.category.toLowerCase().includes(nicheLower) ||
          l.companyName.toLowerCase().includes(nicheLower),
      )
      .map((l, index) => ({
        placeId: l.id,
        name: l.companyName,
        category: l.category,
        latitude: l.latitude,
        longitude: l.longitude,
        address: l.address,
        neighborhood: l.neighborhood ?? null,
        city: l.city,
        state: l.state,
        phone: l.phone ?? null,
        website: l.website ?? null,
        hasWebsite: l.hasWebsite,
        email: l.email ?? null,
        instagram: l.instagram ?? null,
        whatsapp: l.whatsapp ?? null,
        rating: l.rating ?? null,
        reviewCount: l.reviewCount ?? null,
        distanceKm: l.distanceKm,
        score: l.score,
        temperature: l.temperature,
        importedLeadId: null, // starts unimported; updated by addToFunnel
        // Deterministic demo seed (by index, never random) so every async
        // badge state can be validated in the browser: index 0-2 show
        // queued/enriching/retrying, index 3 shows a provisional score.
        pipelineState:
          index === 0 ? "queued" : index === 1 ? "enriching" : index === 2 ? "retrying" : null,
        enrichmentState: index === 3 ? "pending" : "enriched",
        enrichmentFields: null,
        primaryCnae: null,
        cnaeDescription: null,
        secondaryCnaes: null,
      }));
    this.discoveryCache.set(id, results);

    demoSearches.unshift({
      id,
      niche: input.query,
      location: input.location.label,
      latitude: input.location.latitude ?? -23.55,
      longitude: input.location.longitude ?? -46.63,
      radiusKm: input.radiusMeters / 1000,
      presence,
      createdAt: new Date().toISOString(),
      totalFound: results.length,
      enrichedCount: results.filter((d) => d.phone || d.email || d.whatsapp).length,
      addedToPipeline: 0,
      contactsFound: results.filter((d) => d.phone || d.email || d.whatsapp).length,
    });
    return { searchId: id };
  }

  async getStatus(searchId: string): Promise<SearchStatusSnapshot> {
    const cached = this.discoveryCache.get(searchId);
    return {
      id: searchId,
      status: "completed",
      foundCount: cached?.length ?? MOCK_LEADS.length,
      importedCount: 0,
      enrichedCount: 0,
      providerRequestCount: 0,
    };
  }

  async cancel(): Promise<void> {}

  async listHistory(): Promise<Search[]> {
    return demoSearches;
  }

  async importResults(): Promise<{ imported: number; duplicates: number }> {
    return { imported: 0, duplicates: 0 };
  }

  async getDiscovery(searchId: string): Promise<DiscoveryResult[]> {
    return this.discoveryCache.get(searchId) ?? [];
  }

  registerDiscovery(searchId: string, results: DiscoveryResult[]): void {
    this.discoveryCache.set(searchId, results);
  }

  async enrichDiscovery(_searchId: string, placeId?: string): Promise<{ enriched: number }> {
    if (!placeId) return { enriched: 0 };
    // Simulate enrichment by copying contact fields from the matching mock lead.
    const lead = MOCK_LEADS.find((l) => l.id === placeId);
    if (!lead) return { enriched: 0 };
    for (const [, results] of this.discoveryCache) {
      const r = results.find((d) => d.placeId === placeId);
      if (r) {
        r.email = lead.email ?? r.email;
        r.instagram = lead.instagram ?? r.instagram;
        r.whatsapp = lead.whatsapp ?? r.whatsapp;
        r.phone = lead.phone ?? r.phone;
      }
    }
    return { enriched: 1 };
  }

  async addToFunnel(
    _searchId: string,
    placeId: string,
    stage: "new" | "contacted",
  ): Promise<{ enrichableLeadIds: string[]; leadIds: string[] }> {
    // Create an actual lead in demoLeads so the Kanban (useLeadsList) sees it.
    const mockLead = MOCK_LEADS.find((l) => l.id === placeId);
    if (!mockLead) return { enrichableLeadIds: [], leadIds: [] };

    const newLead: Lead = {
      ...mockLead,
      id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      stage,
      discoveredAt: new Date().toISOString(),
      notes: [...mockLead.notes],
      activities: [],
      timeline: [
        ...mockLead.timeline,
        {
          id: `t-${Date.now()}`,
          kind: stage,
          label: stage === "contacted" ? "Contatado via WhatsApp" : "Adicionado ao pipeline",
          at: new Date().toISOString(),
        },
      ],
    };
    demoLeads = [newLead, ...demoLeads];

    // Update discovery cache so the sidebar shows "No pipeline" immediately.
    for (const [, results] of this.discoveryCache) {
      const r = results.find((d) => d.placeId === placeId);
      if (r) r.importedLeadId = newLead.id;
    }

    const enrichable = newLead.hasWebsite ? [newLead.id] : [];
    return { enrichableLeadIds: enrichable, leadIds: [newLead.id] };
  }

  async enrichLead(_leadId: string): Promise<void> {
    // no-op no modo demo.
  }

  async saveSearch(_searchId: string, _name: string): Promise<void> {
    // no-op no modo demo.
  }

  async unsaveSearch(_searchId: string): Promise<void> {
    // no-op no modo demo.
  }

  async listSavedSearches(): Promise<SavedSearch[]> {
    return [];
  }

  /** Demo has no persisted opportunity scores — client-side calc is the fallback. */
  async getOpportunityScore(_placeId: string): Promise<PersistedOpportunityScore | null> {
    return null;
  }

  /** Demo has no server-side territories — the client-side aggregation runs. */
  async listTerritoryStats(_searchId: string): Promise<TerritoryStats[]> {
    return [];
  }

  /** Demo has no real pipeline rows — honest empty (UI shows "aguardando"). */
  async getMissionPipeline(
    _searchId: string,
  ): Promise<{ jobs: MissionJobRow[]; sources: MissionSourceRow[] }> {
    return { jobs: [], sources: [] };
  }

  /** Demo has no real timeline rows — honest empty. */
  async getCompanyTimeline(_placeId: string): Promise<CompanyTimelineData> {
    return { jobs: [], sources: [], scores: [], leadEvents: [] };
  }
}

export class DemoDashboardRepository implements DashboardRepository {
  async overview(_p: DashboardPeriod, start: Date, end: Date): Promise<DashboardOverview> {
    const inPeriod = demoLeads.filter((l) => {
      const at = new Date(l.discoveredAt).getTime();
      return at >= start.getTime() && at < end.getTime();
    });
    const won = inPeriod.filter((l) => l.stage === "won");
    const count = (fn: (l: Lead) => string) =>
      inPeriod.reduce<Record<string, number>>((acc, l) => {
        acc[fn(l)] = (acc[fn(l)] ?? 0) + 1;
        return acc;
      }, {});
    return {
      totalLeads: inPeriod.length,
      byStage: count((l) => l.stage),
      byStageValue: Object.fromEntries(
        Object.entries(count((l) => l.stage)).map(([stage]) => [
          stage,
          inPeriod
            .filter((l) => l.stage === stage)
            .reduce(
              (s, l) => s + (stage === "won" ? (l.closedValue ?? 0) : (l.estimatedValue ?? 0)),
              0,
            ),
        ]),
      ),
      byTemperature: count((l) => l.temperature),
      byCity: Object.entries(count((l) => l.city)).map(([city, c]) => ({
        city,
        count: c,
        won: won.filter((l) => l.city === city).length,
        qualified: inPeriod.filter((l) => l.city === city && l.stage === "qualified").length,
        contacted: inPeriod.filter((l) => l.city === city && l.stage === "contacted").length,
        revenue: won.filter((l) => l.city === city).reduce((s, l) => s + (l.closedValue ?? 0), 0),
      })),
      byCategory: Object.entries(count((l) => l.category)).map(([category, c]) => ({
        category,
        count: c,
        won: won.filter((l) => l.category === category).length,
        qualified: inPeriod.filter((l) => l.category === category && l.stage === "qualified")
          .length,
        contacted: inPeriod.filter((l) => l.category === category && l.stage === "contacted")
          .length,
        revenue: won
          .filter((l) => l.category === category)
          .reduce((s, l) => s + (l.closedValue ?? 0), 0),
      })),
      contacted: inPeriod.filter((l) => ["contacted", "won"].includes(l.stage)).length,
      wonCount: won.length,
      wonValue: won.reduce((s, l) => s + (l.closedValue ?? 0), 0),
      avgTicket: won.length ? won.reduce((s, l) => s + (l.closedValue ?? 0), 0) / won.length : 0,
      pipelineValue: inPeriod
        .filter((l) => ["qualified", "contacted"].includes(l.stage))
        .reduce((s, l) => s + (l.estimatedValue ?? 0), 0),
      avgDaysToClose: 0,
      conversionRate: inPeriod.length ? (won.length / inPeriod.length) * 100 : 0,
      searchCount: demoSearches.length,
      importedCount: 0,
      // ── Fase 4 (espelho da extensão da RPC no modo demo) ──
      enrichedCount: inPeriod.filter((l) => l.phone || l.whatsapp || l.email).length,
      respondedCount: inPeriod.filter((l) => l.respondedAt).length,
      meetingCount: inPeriod.filter((l) => l.meetingAt).length,
      proposalCount: inPeriod.filter((l) => l.proposalAt).length,
      discardedCount: inPeriod.filter((l) => l.stage === "discarded").length,
      pipelineCount: inPeriod.filter((l) => !["discarded", "won"].includes(l.stage)).length,
      pipelineValueWindowed: inPeriod
        .filter((l) => !["discarded", "won"].includes(l.stage))
        .reduce((s, l) => s + (l.estimatedValue ?? 0), 0),
      channels: {
        whatsapp: inPeriod.filter((l) => l.whatsapp).length,
        phone: inPeriod.filter((l) => l.phone).length,
        instagram: inPeriod.filter((l) => l.instagram).length,
        email: inPeriod.filter((l) => l.email).length,
        site: inPeriod.filter((l) => l.hasWebsite).length,
      },
      dailySeries: [],
      allTime: {
        totalFound: demoLeads.length,
        withoutWebsite: demoLeads.filter((l) => !l.hasWebsite).length,
        noReviews: demoLeads.filter((l) => l.reviewCount === 0).length,
        lowRating: demoLeads.filter((l) => l.rating != null && l.rating < 4).length,
        hot: demoLeads.filter((l) => l.temperature === "hot").length,
        contacted: demoLeads.filter((l) => l.lastInteractionAt != null).length,
        responded: demoLeads.filter((l) => l.respondedAt != null).length,
        meetings: demoLeads.filter((l) => l.meetingAt != null).length,
        proposals: demoLeads.filter((l) => l.proposalAt != null).length,
        won: demoLeads.filter((l) => l.stage === "won").length,
        revenue: demoLeads.reduce((s, l) => s + (l.closedValue ?? 0), 0),
        cities: [...new Set(demoLeads.map((l) => l.city).filter(Boolean))].sort(),
      },
    };
  }
}
