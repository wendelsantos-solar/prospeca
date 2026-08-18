import { describe, expect, test } from "bun:test";
import {
  buildFieldMap,
  buildSourceState,
  deriveEnrichmentState,
  deriveSourceState,
  ENRICHMENT_SOURCE_TTL_DAYS,
  fieldDisplay,
  isEnrichmentSourceStale,
  type EnrichmentFieldMap,
} from "./enrichment-state.ts";

describe("deriveEnrichmentState", () => {
  test("empty map → pending (never checked)", () => {
    expect(deriveEnrichmentState({})).toBe("pending");
  });

  test("all complete → enriched", () => {
    const map: EnrichmentFieldMap = {
      email: { status: "complete", has: true },
      instagram: { status: "complete", has: false },
      whatsapp: { status: "complete", has: false },
    };
    expect(deriveEnrichmentState(map)).toBe("enriched");
  });

  test("complete + failed mix → partial", () => {
    const map: EnrichmentFieldMap = {
      email: { status: "complete", has: true },
      instagram: { status: "failed", has: false },
    };
    expect(deriveEnrichmentState(map)).toBe("partial");
  });

  test("all failed → failed", () => {
    const map: EnrichmentFieldMap = {
      email: { status: "failed", has: false },
      whatsapp: { status: "failed", has: false },
    };
    expect(deriveEnrichmentState(map)).toBe("failed");
  });

  test("single complete → enriched (not partial)", () => {
    expect(deriveEnrichmentState({ email: { status: "complete", has: true } })).toBe("enriched");
  });
});

describe("buildFieldMap", () => {
  test("complete with has flags + failed, no overlap clobber", () => {
    const map = buildFieldMap(
      [
        { field: "email", has: true },
        { field: "instagram", has: false },
      ],
      ["whatsapp"],
    );
    expect(map).toEqual({
      email: { status: "complete", has: true },
      instagram: { status: "complete", has: false },
      whatsapp: { status: "failed", has: false },
    });
  });

  test("failed does not overwrite an existing complete entry", () => {
    const map = buildFieldMap([{ field: "email", has: true }], ["email"]);
    expect(map.email).toEqual({ status: "complete", has: true });
  });
});

describe("fieldDisplay", () => {
  test("value always wins", () => {
    expect(fieldDisplay(undefined, true, "pending")).toBe("value");
  });

  test("complete without value → not_found", () => {
    expect(fieldDisplay("complete", false, "enriched")).toBe("not_found");
  });

  test("failed → error", () => {
    expect(fieldDisplay("failed", false, "failed")).toBe("error");
  });

  test("overall processing → checking (for a still-pending field)", () => {
    expect(fieldDisplay(undefined, false, "processing")).toBe("checking");
  });

  test("no field status, overall pending → pending (not yet verified)", () => {
    expect(fieldDisplay(undefined, false, "pending")).toBe("pending");
  });
});

describe("multi-source state (Fase 5)", () => {
  const fetched = new Date("2026-08-15T12:00:00Z");

  test("buildSourceState stamps status/fetchedAt/expiresAt with the TTL", () => {
    const s = buildSourceState("enriched", fetched, 30);
    expect(s.status).toBe("enriched");
    expect(s.fetchedAt).toBe("2026-08-15T12:00:00.000Z");
    expect(s.expiresAt).toBe("2026-09-14T12:00:00.000Z"); // +30d
  });

  test("deriveSourceState: absent → pending; present → its status", () => {
    expect(deriveSourceState(null, "website")).toBe("pending");
    expect(deriveSourceState({}, "website")).toBe("pending");
    expect(
      deriveSourceState({ website: buildSourceState("enriched", fetched, 30) }, "website"),
    ).toBe("enriched");
    expect(
      deriveSourceState(
        { website: buildSourceState("enriched", fetched, 30) },
        "business_registry",
      ),
    ).toBe("pending");
  });

  test("isEnrichmentSourceStale: never checked → stale; fresh success → not stale; past TTL → stale", () => {
    expect(isEnrichmentSourceStale(null, "website")).toBe(true);
    expect(isEnrichmentSourceStale({}, "website")).toBe(true);

    const fresh = { website: buildSourceState("enriched", fetched, 30) };
    expect(isEnrichmentSourceStale(fresh, "website", new Date("2026-08-20T00:00:00Z"))).toBe(false);
    expect(isEnrichmentSourceStale(fresh, "website", new Date("2026-09-15T00:00:00Z"))).toBe(true);
  });

  test("isEnrichmentSourceStale: failed source is ALWAYS re-checkable (no TTL lock-out)", () => {
    const failed = { website: buildSourceState("failed", fetched, 30) };
    expect(isEnrichmentSourceStale(failed, "website", new Date("2026-08-16T00:00:00Z"))).toBe(true);
  });

  test("isEnrichmentSourceStale: missing expiresAt → stale (conservative)", () => {
    expect(isEnrichmentSourceStale({ website: { status: "enriched" } }, "website")).toBe(true);
  });

  test("registry TTL is 90d, website TTL is 30d", () => {
    expect(ENRICHMENT_SOURCE_TTL_DAYS.website).toBe(30);
    expect(ENRICHMENT_SOURCE_TTL_DAYS.business_registry).toBe(90);
  });

  test("retrocompat: global deriveEnrichmentState untouched by sources", () => {
    // The global state machine still derives from the field map only.
    const map: EnrichmentFieldMap = { email: { status: "complete", has: true } };
    expect(deriveEnrichmentState(map)).toBe("enriched");
  });
});
