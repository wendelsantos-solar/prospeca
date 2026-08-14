import { describe, expect, test } from "bun:test";
import {
  buildCompanyTimeline,
  jobTypeLabel,
  sourceProviderLabel,
  type CompanyTimelineInput,
} from "./company-timeline";

const base: CompanyTimelineInput = {
  jobs: [],
  sources: [],
  scores: [],
  leadEvents: [],
};

describe("buildCompanyTimeline", () => {
  test("empty input → empty timeline (no fabrication)", () => {
    expect(buildCompanyTimeline(base)).toEqual([]);
  });

  test("orders newest first (real timestamps)", () => {
    const timeline = buildCompanyTimeline({
      jobs: [
        {
          id: "j1",
          type: "OPPORTUNITY_SCORING",
          status: "completed",
          createdAt: "2026-08-15T10:00:00Z",
          finishedAt: "2026-08-15T10:05:00Z",
        },
      ],
      sources: [
        { id: "s1", provider: "google_places", fetchedAt: "2026-08-15T09:00:00Z" },
      ],
      scores: [
        {
          id: "sc1",
          calculatedAt: "2026-08-15T10:05:00Z",
          score: 74,
          temperature: "warm",
          ruleVersion: "v1.2.0",
        },
      ],
      leadEvents: [{ id: "l1", type: "contacted", label: "Contato via WhatsApp", at: "2026-08-16T08:00:00Z" }],
    });
    const times = timeline.map((e) => e.at);
    const sorted = [...times].sort((a, b) => (a < b ? 1 : -1));
    expect(times).toEqual(sorted);
  });

  test("system vs commercial kinds are preserved", () => {
    const timeline = buildCompanyTimeline({
      ...base,
      jobs: [
        {
          id: "j1",
          type: "BUSINESS_DATA_ENRICHMENT",
          status: "completed",
          createdAt: "2026-08-15T10:00:00Z",
          finishedAt: "2026-08-15T10:04:00Z",
        },
      ],
      leadEvents: [{ id: "l1", type: "added_to_pipeline", label: "Adicionado ao funil", at: "2026-08-15T11:00:00Z" }],
    });
    const system = timeline.filter((e) => e.kind === "system");
    const commercial = timeline.filter((e) => e.kind === "commercial");
    expect(system.length).toBe(2); // queued + completed
    expect(commercial).toHaveLength(1);
  });

  test("job failed event carries the error detail", () => {
    const timeline = buildCompanyTimeline({
      ...base,
      jobs: [
        {
          id: "j1",
          type: "BUSINESS_DATA_ENRICHMENT",
          status: "failed",
          createdAt: "2026-08-15T10:00:00Z",
          finishedAt: "2026-08-15T10:04:00Z",
          error: "website fetch failed",
        },
      ],
    });
    const failed = timeline.find((e) => e.type === "job_failed")!;
    expect(failed.detail).toBe("website fetch failed");
  });

  test("source failed event when the source row has an error", () => {
    const timeline = buildCompanyTimeline({
      ...base,
      sources: [
        {
          id: "s1",
          provider: "business_registry",
          fetchedAt: "2026-08-15T09:00:00Z",
          error: "timeout",
        },
      ],
    });
    const ev = timeline[0];
    expect(ev.type).toBe("source_failed");
    expect(ev.detail).toBe("timeout");
  });

  test("rows without timestamps produce no events (honest)", () => {
    const timeline = buildCompanyTimeline({
      ...base,
      jobs: [{ id: "j1", type: "X", status: "completed" }],
      sources: [{ id: "s1", provider: "website" }],
      scores: [{ id: "sc1", calculatedAt: null }],
    });
    expect(timeline).toEqual([]);
  });

  test("labels are human-readable", () => {
    expect(jobTypeLabel("OPPORTUNITY_SCORING")).toBe("Qualificação (score)");
    expect(jobTypeLabel("UNKNOWN_TYPE")).toBe("UNKNOWN_TYPE");
    expect(sourceProviderLabel("business_registry")).toBe("Cadastro público (CNPJ)");
  });
});
