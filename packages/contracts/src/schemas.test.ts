import { describe, expect, test } from "bun:test";
import {
  CreateSearchInputSchema,
  CreateExportSchema,
  ImportSearchResultsSchema,
  FeedbackInputSchema,
  LEAD_STAGES,
  LEAD_TEMPERATURES,
  DASHBOARD_PERIODS,
} from "./schemas";

describe("CreateSearchInputSchema", () => {
  test("accepts valid input", () => {
    const result = CreateSearchInputSchema.safeParse({
      query: "restaurantes",
      location: { label: "São Paulo, SP", placeId: "abc123" },
      radiusMeters: 5000,
      presenceFilter: "all",
    });
    expect(result.success).toBe(true);
  });

  test("rejects short query", () => {
    const result = CreateSearchInputSchema.safeParse({
      query: "a",
      location: { label: "São Paulo, SP" },
      radiusMeters: 5000,
      presenceFilter: "all",
    });
    expect(result.success).toBe(false);
  });

  test("rejects invalid presence filter", () => {
    const result = CreateSearchInputSchema.safeParse({
      query: "restaurantes",
      location: { label: "São Paulo, SP" },
      radiusMeters: 5000,
      presenceFilter: "invalid",
    });
    expect(result.success).toBe(false);
  });

  test("accepts optional fields", () => {
    const result = CreateSearchInputSchema.safeParse({
      query: "restaurantes",
      category: "comida",
      location: { label: "São Paulo, SP", latitude: -23.5, longitude: -46.6 },
      radiusMeters: 5000,
      presenceFilter: "without_website",
      maxResults: 100,
      forceRefresh: true,
    });
    expect(result.success).toBe(true);
  });
});

describe("ImportSearchResultsSchema", () => {
  test("accepts valid import", () => {
    const result = ImportSearchResultsSchema.safeParse({
      searchId: "00000000-0000-0000-0000-000000000001",
      placeIds: ["00000000-0000-0000-0000-000000000002"],
    });
    expect(result.success).toBe(true);
  });

  test("defaults importAll to false", () => {
    const result = ImportSearchResultsSchema.parse({
      searchId: "00000000-0000-0000-0000-000000000001",
    });
    expect(result.importAll).toBe(false);
    expect(result.placeIds).toEqual([]);
    expect(result.stage).toBe("new");
  });

  test("rejects invalid stage", () => {
    const result = ImportSearchResultsSchema.safeParse({
      searchId: "00000000-0000-0000-0000-000000000001",
      stage: "invalid",
    });
    expect(result.success).toBe(false);
  });
});

describe("FeedbackInputSchema", () => {
  test("accepts valid feedback", () => {
    const result = FeedbackInputSchema.safeParse({
      type: "bug",
      message: "This is a bug report with enough text",
    });
    expect(result.success).toBe(true);
  });

  test("rejects short message", () => {
    const result = FeedbackInputSchema.safeParse({
      type: "bug",
      message: "short",
    });
    expect(result.success).toBe(false);
  });
});

describe("domain constants", () => {
  test("LEAD_STAGES has the expected values", () => {
    expect(LEAD_STAGES).toEqual(["new", "qualified", "contacted", "won", "discarded"]);
  });

  test("LEAD_TEMPERATURES has the expected values", () => {
    expect(LEAD_TEMPERATURES).toEqual(["hot", "warm", "cold"]);
  });

  test("DASHBOARD_PERIODS has the expected values", () => {
    expect(DASHBOARD_PERIODS).toEqual(["today", "7d", "30d", "90d", "year", "custom"]);
  });
});

describe("CreateExportSchema (V3-F)", () => {
  test("valid csv request with fields", () => {
    const r = CreateExportSchema.safeParse({
      format: "csv",
      fields: ["company_name", "score", "phone"],
    });
    expect(r.success).toBe(true);
  });
  test("invalid format → 422 (rejected)", () => {
    const r = CreateExportSchema.safeParse({ format: "pdf", fields: ["company_name"] });
    expect(r.success).toBe(false);
  });
  test("unknown fields → 422 (rejected, never silently ignored)", () => {
    const r = CreateExportSchema.safeParse({
      format: "xlsx",
      fields: ["company_name", "hacker_field"],
    });
    expect(r.success).toBe(false);
  });
  test("columns alias (retrocompat) still works", () => {
    const r = CreateExportSchema.safeParse({ format: "csv", columns: ["company_name"] });
    expect(r.success).toBe(true);
  });
  test("neither fields nor columns → rejected", () => {
    expect(CreateExportSchema.safeParse({ format: "csv" }).success).toBe(false);
  });
});
