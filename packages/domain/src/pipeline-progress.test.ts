import { describe, expect, test } from "bun:test";
import { derivePipeline, PIPELINE_ICON, type MissionPipelineInput } from "./pipeline-progress";

const base: MissionPipelineInput = {
  searchStatus: null,
  foundCount: 0,
  totalPlaces: 0,
  jobCounts: {},
  sourceCounts: {
    website: { done: 0, running: 0, failed: 0 },
    registry: { done: 0, running: 0, failed: 0 },
  },
};

describe("derivePipeline", () => {
  test("empty mission → all steps waiting, no fabricated progress", () => {
    const steps = derivePipeline(base);
    expect(steps.map((s) => s.state)).toEqual(["waiting", "waiting", "waiting", "waiting"]);
    expect(steps[2].detail).toBe("sob consulta"); // CNPJ is on-demand — honest
  });

  test("search running → discovery running, others waiting", () => {
    const steps = derivePipeline({ ...base, searchStatus: "searching", foundCount: 5 });
    expect(steps[0]).toMatchObject({ state: "running", detail: "searching" });
    expect(steps[1].state).toBe("waiting");
  });

  test("completed search + all scored → discovery done, qualification done", () => {
    const steps = derivePipeline({
      ...base,
      searchStatus: "completed",
      foundCount: 16,
      totalPlaces: 16,
      jobCounts: { OPPORTUNITY_SCORING: { completed: 16 } },
    });
    expect(steps[0]).toMatchObject({ state: "done", detail: "16 empresas" });
    expect(steps[3]).toMatchObject({ state: "done", detail: "16/16" });
  });

  test("scoring in flight → qualification running with real counts", () => {
    const steps = derivePipeline({
      ...base,
      searchStatus: "completed",
      foundCount: 16,
      totalPlaces: 16,
      jobCounts: { OPPORTUNITY_SCORING: { completed: 10, processing: 6 } },
    });
    expect(steps[3]).toMatchObject({ state: "running", detail: "10/16" });
  });

  test("partial search is honest (done + parcial)", () => {
    const steps = derivePipeline({ ...base, searchStatus: "partial", foundCount: 20 });
    expect(steps[0].state).toBe("done");
    expect(steps[0].detail).toContain("parcial");
  });

  test("search failed → discovery failed", () => {
    const steps = derivePipeline({ ...base, searchStatus: "failed" });
    expect(steps[0].state).toBe("failed");
  });

  test("website enrichment: running while jobs in flight, done with ✗ when mixed", () => {
    const running = derivePipeline({
      ...base,
      searchStatus: "completed",
      sourceCounts: {
        website: { done: 5, running: 3, failed: 0 },
        registry: { done: 0, running: 0, failed: 0 },
      },
      jobCounts: { BUSINESS_DATA_ENRICHMENT: { processing: 2 } },
    });
    expect(running[1].state).toBe("running");

    const mixed = derivePipeline({
      ...base,
      searchStatus: "completed",
      sourceCounts: {
        website: { done: 37, running: 0, failed: 4 },
        registry: { done: 0, running: 0, failed: 0 },
      },
    });
    expect(mixed[1].state).toBe("done");
    expect(mixed[1].detail).toContain("✗4");
  });

  test("website all failed → enrichment failed (honest, not silent)", () => {
    const steps = derivePipeline({
      ...base,
      searchStatus: "completed",
      sourceCounts: {
        website: { done: 0, running: 0, failed: 9 },
        registry: { done: 0, running: 0, failed: 0 },
      },
    });
    expect(steps[1].state).toBe("failed");
    expect(steps[1].detail).toContain("✗9");
  });

  test("registry: on-demand — done when consulted, failed when source down", () => {
    const consulted = derivePipeline({
      ...base,
      searchStatus: "completed",
      sourceCounts: {
        website: { done: 0, running: 0, failed: 0 },
        registry: { done: 42, running: 0, failed: 8 },
      },
    });
    expect(consulted[2].state).toBe("done");
    expect(consulted[2].detail).toContain("✓42");
    expect(consulted[2].detail).toContain("✗8");

    const down = derivePipeline({
      ...base,
      searchStatus: "completed",
      sourceCounts: {
        website: { done: 0, running: 0, failed: 0 },
        registry: { done: 0, running: 0, failed: 2 },
      },
    });
    expect(down[2].state).toBe("failed");
  });

  test("icon map is stable (✓/⟳/○/✗)", () => {
    expect(PIPELINE_ICON).toEqual({ done: "✓", running: "⟳", waiting: "○", failed: "✗" });
  });
});
