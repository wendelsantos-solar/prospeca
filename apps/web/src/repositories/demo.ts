// Demo repositories — explicit demo mode only (VITE_DATA_MODE=demo).
// Never used as silent fallback in production.
import type {
  Lead,
  LeadNote,
  LeadActivity,
  Search,
  CreateLeadNoteInput,
  CreateLeadActivityInput,
  DashboardPeriod,
} from "@/types";
import { MOCK_LEADS } from "@/mocks/leads";
import { applyFilters } from "@/lib/filters";
import type {
  CreateSearchInput,
  DashboardOverview,
  DashboardRepository,
  LeadRepository,
  ListLeadsInput,
  MoveLeadInput,
  PaginatedResult,
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
      lastInteractionAt: new Date().toISOString(),
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
}

export class DemoSearchRepository implements SearchRepository {
  async create(input: CreateSearchInput): Promise<{ searchId: string }> {
    const id = `demo-search-${Date.now()}`;
    demoSearches.unshift({
      id,
      niche: input.query,
      location: input.location.label,
      latitude: input.location.latitude ?? -23.55,
      longitude: input.location.longitude ?? -46.63,
      radiusKm: input.radiusMeters / 1000,
      presence:
        input.presenceFilter === "without_website"
          ? "no-website"
          : input.presenceFilter === "with_website"
            ? "with-website"
            : "all",
      createdAt: new Date().toISOString(),
      totalFound: MOCK_LEADS.length,
      enrichedCount: 0,
      addedToPipeline: 0,
      contactsFound: 0,
    });
    return { searchId: id };
  }

  async getStatus(searchId: string): Promise<SearchStatusSnapshot> {
    return {
      id: searchId,
      status: "completed",
      foundCount: MOCK_LEADS.length,
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
