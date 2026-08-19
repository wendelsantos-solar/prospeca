import { describe, expect, test } from "bun:test";
import { companyStatusFromBusinessStatus, isSourceStale, type CompanySource } from "./company";

describe("companyStatusFromBusinessStatus", () => {
  test("maps OPERATIONAL → operational", () => {
    expect(companyStatusFromBusinessStatus("OPERATIONAL")).toBe("operational");
  });
  test("maps closed states → closed", () => {
    expect(companyStatusFromBusinessStatus("CLOSED_TEMPORARILY")).toBe("closed");
    expect(companyStatusFromBusinessStatus("CLOSED_PERMANENTLY")).toBe("closed");
  });
  test("unknown / null / arbitrary → unknown", () => {
    expect(companyStatusFromBusinessStatus(null)).toBe("unknown");
    expect(companyStatusFromBusinessStatus(undefined)).toBe("unknown");
    expect(companyStatusFromBusinessStatus("SUSPENDED")).toBe("unknown");
  });
});

describe("isSourceStale", () => {
  const source = (expiresAt: string | null): Pick<CompanySource, "expiresAt"> => ({ expiresAt });
  const now = new Date("2026-08-12T12:00:00Z");

  test("expired source is stale", () => {
    expect(isSourceStale(source("2026-08-11T00:00:00Z"), now)).toBe(true);
  });
  test("future expiry is not stale", () => {
    expect(isSourceStale(source("2026-08-13T00:00:00Z"), now)).toBe(false);
  });
  test("missing expiry is never stale", () => {
    expect(isSourceStale(source(null), now)).toBe(false);
  });
});
