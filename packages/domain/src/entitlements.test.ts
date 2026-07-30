import { describe, expect, test } from "bun:test";
import {
  hasFeature,
  remaining,
  canConsume,
  isUnlimited,
  type PlanEntitlements,
} from "./entitlements";

const solo: PlanEntitlements = {
  features: {
    lead_search: true,
    advanced_filters: true,
    pipeline: true,
    saved_searches: true,
    search_monitoring: false,
    csv_export: true,
    xlsx_export: false,
    message_templates: true,
    cadences: false,
    automations: false,
    advanced_analytics: false,
    team_management: false,
    custom_permissions: false,
    api_access: false,
  },
  limits: {
    users: 1,
    searchesPerMonth: 60,
    processedLeadsPerMonth: 500,
    savedSearches: 10,
    activeMonitors: 0,
    pipelines: 1,
    messageTemplates: 20,
    exportRowsPerMonth: 2000,
  },
};

const team: PlanEntitlements = {
  ...solo,
  limits: { ...solo.limits, processedLeadsPerMonth: -1 },
};

describe("hasFeature", () => {
  test("true for an enabled feature", () => {
    expect(hasFeature(solo, "csv_export")).toBe(true);
  });
  test("false for a disabled feature", () => {
    expect(hasFeature(solo, "search_monitoring")).toBe(false);
  });
});

describe("remaining", () => {
  test("subtracts usage from the limit", () => {
    expect(remaining(solo, { processedLeadsPerMonth: 328 }, "processedLeadsPerMonth")).toBe(172);
  });
  test("floors at zero, never negative", () => {
    expect(remaining(solo, { processedLeadsPerMonth: 999 }, "processedLeadsPerMonth")).toBe(0);
  });
  test("no usage recorded yet -> full limit", () => {
    expect(remaining(solo, {}, "savedSearches")).toBe(10);
  });
  test("-1 limit -> null (unlimited)", () => {
    expect(
      remaining(team, { processedLeadsPerMonth: 50_000 }, "processedLeadsPerMonth"),
    ).toBeNull();
  });
});

describe("canConsume", () => {
  test("allows consumption within the remaining limit", () => {
    expect(canConsume(solo, { savedSearches: 8 }, "savedSearches", 2)).toBe(true);
  });
  test("refuses consumption past the limit", () => {
    expect(canConsume(solo, { savedSearches: 9 }, "savedSearches", 2)).toBe(false);
  });
  test("unlimited metric always allows consumption", () => {
    expect(
      canConsume(team, { processedLeadsPerMonth: 1_000_000 }, "processedLeadsPerMonth", 500),
    ).toBe(true);
  });
});

describe("isUnlimited", () => {
  test("true when the limit is -1", () => {
    expect(isUnlimited(team, "processedLeadsPerMonth")).toBe(true);
  });
  test("false for a finite limit", () => {
    expect(isUnlimited(solo, "processedLeadsPerMonth")).toBe(false);
  });
});
