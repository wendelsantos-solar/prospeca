import { describe, expect, test } from "bun:test";
import { enrichmentDisplayFor, isProvisionalScore } from "./enrichment";

describe("enrichmentDisplayFor", () => {
  test("value wins regardless of state", () => {
    const d = enrichmentDisplayFor("email", true, "pending", null);
    expect(d.kind).toBe("value");
    expect(d.label).toBe("");
  });

  test("complete without value → not_found (checked, genuinely absent)", () => {
    const d = enrichmentDisplayFor("instagram", false, "enriched", {
      instagram: { status: "complete", has: false },
    });
    expect(d.kind).toBe("not_found");
    expect(d.label).toBe("Não encontrado");
  });

  test("never checked (pending) → 'ainda não verificado'", () => {
    const d = enrichmentDisplayFor("whatsapp", false, "pending", null);
    expect(d.kind).toBe("pending");
    expect(d.label).toBe("Ainda não verificado");
  });

  test("processing → 'verificando'", () => {
    const d = enrichmentDisplayFor("email", false, "processing", {});
    expect(d.kind).toBe("checking");
    expect(d.label).toBe("Verificando…");
  });

  test("failed field → error", () => {
    const d = enrichmentDisplayFor("instagram", false, "failed", {
      instagram: { status: "failed", has: false },
    });
    expect(d.kind).toBe("error");
    expect(d.label).toBe("Erro na consulta");
  });
});

describe("isProvisionalScore", () => {
  test("pending/processing/undefined → provisional", () => {
    expect(isProvisionalScore(undefined)).toBe(true);
    expect(isProvisionalScore("pending")).toBe(true);
    expect(isProvisionalScore("processing")).toBe(true);
  });

  test("enriched/partial/failed → not provisional", () => {
    expect(isProvisionalScore("enriched")).toBe(false);
    expect(isProvisionalScore("partial")).toBe(false);
    expect(isProvisionalScore("failed")).toBe(false);
  });
});
