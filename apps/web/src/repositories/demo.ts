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
  CreateSearchInput,
  DashboardOverview,
  DashboardRepository,
  DiscoveryResult,
  LeadRepository,
  ListLeadsInput,
  MoveLeadInput,
  PaginatedResult,
  PersistedOpportunityScore,
  SearchRepository,
  SearchStatusSnapshot,
  UpdateLeadInput,
} from "./types";

let demoLeads: Lead[] = [...MOCK_LEADS];
const demoSearches: Search[] = [];

export function seedDemoLeads(leads: Lead[]) {
  demoLeads = [...leads];
}

export class DemoLeadRepository implements LeadRepository {
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

  async create(input: CreateSearchInput): Promise<{ searchId: string }> {
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
      .map((l) => ({
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
        // Demo data is pre-populated; treat it as already enriched so the
        // drawer never shows "verificando" on fictional leads.
        enrichmentState: "enriched",
        enrichmentFields: null,
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
      byTemperature: count((l) => l.temperature),
      byCity: Object.entries(count((l) => l.city)).map(([city, c]) => ({
        city,
        count: c,
        won: won.filter((l) => l.city === city).length,
      })),
      byCategory: Object.entries(count((l) => l.category)).map(([category, c]) => ({
        category,
        count: c,
        won: won.filter((l) => l.category === category).length,
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
    };
  }
}
