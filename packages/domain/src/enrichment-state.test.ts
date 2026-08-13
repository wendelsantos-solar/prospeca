import { describe, expect, test } from "bun:test";
import {
  buildFieldMap,
  deriveEnrichmentState,
  fieldDisplay,
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
