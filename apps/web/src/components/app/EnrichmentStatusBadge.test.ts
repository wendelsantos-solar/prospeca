import { describe, expect, test } from "bun:test";
import {
  ENRICHMENT_STATUS_META,
  resolveEnrichmentStatus,
  type EnrichmentStatusState,
} from "../../lib/enrichment";

describe("resolveEnrichmentStatus — precedência do badge assíncrono", () => {
  test("estados em voo do pipeline vencem qualquer outro estado", () => {
    expect(resolveEnrichmentStatus("retrying", "pending")).toBe("retrying");
    expect(resolveEnrichmentStatus("enriching", "pending")).toBe("enriching");
    expect(resolveEnrichmentStatus("queued", "failed")).toBe("queued");
  });

  test("precedência completa: retrying > enriching > queued > failed > provisional", () => {
    expect(resolveEnrichmentStatus("retrying", "failed")).toBe("retrying");
    expect(resolveEnrichmentStatus("enriching", "failed")).toBe("enriching");
    expect(resolveEnrichmentStatus("queued", "failed")).toBe("queued");
    expect(resolveEnrichmentStatus(null, "failed")).toBe("failed");
    expect(resolveEnrichmentStatus(null, "pending")).toBe("provisional");
  });

  test("failed só aparece sem job de pipeline e com enriquecimento falho", () => {
    expect(resolveEnrichmentStatus(null, "failed")).toBe("failed");
    expect(resolveEnrichmentStatus(undefined, "failed")).toBe("failed");
    expect(resolveEnrichmentStatus("queued", "failed")).not.toBe("failed");
    expect(resolveEnrichmentStatus(null, "enriched")).not.toBe("failed");
  });

  test("provisional quando não há pipeline e o score ainda é preliminar", () => {
    expect(resolveEnrichmentStatus(null, "pending")).toBe("provisional");
    expect(resolveEnrichmentStatus(null, "processing")).toBe("provisional");
    expect(resolveEnrichmentStatus(null, undefined)).toBe("provisional");
  });

  test("pipelineState presente suprime o badge provisório", () => {
    for (const pipeline of ["queued", "enriching", "retrying"] as const) {
      expect(resolveEnrichmentStatus(pipeline, "pending")).not.toBe("provisional");
      expect(resolveEnrichmentStatus(pipeline, "processing")).not.toBe("provisional");
      expect(resolveEnrichmentStatus(pipeline, undefined)).not.toBe("provisional");
    }
  });

  test("estados terminais saudáveis não mostram badge nenhum", () => {
    expect(resolveEnrichmentStatus(null, "enriched")).toBeNull();
    expect(resolveEnrichmentStatus(null, "partial")).toBeNull();
    expect(resolveEnrichmentStatus(undefined, "enriched")).toBeNull();
  });
});

describe("ENRICHMENT_STATUS_META — rótulos e acessibilidade", () => {
  test("rótulos permanecem em português, no mesmo tom dos atuais", () => {
    expect(ENRICHMENT_STATUS_META.queued.label).toBe("na fila");
    expect(ENRICHMENT_STATUS_META.enriching.label).toBe("enriquecendo");
    expect(ENRICHMENT_STATUS_META.retrying.label).toBe("reprocessando");
    expect(ENRICHMENT_STATUS_META.failed.label).toBe("score parcial");
    expect(ENRICHMENT_STATUS_META.provisional.label).toBe("provisório");
  });

  test("todo estado tem aria-label legível por humano e title explicativo", () => {
    for (const state of Object.keys(ENRICHMENT_STATUS_META) as EnrichmentStatusState[]) {
      const meta = ENRICHMENT_STATUS_META[state];
      expect(meta.ariaLabel.length).toBeGreaterThan(10);
      expect(meta.ariaLabel.toLowerCase()).toContain("empresa");
      expect(meta.title.length).toBeGreaterThan(0);
    }
  });

  test("só os estados em voo giram (spinner)", () => {
    expect(ENRICHMENT_STATUS_META.queued.spinner).toBe(true);
    expect(ENRICHMENT_STATUS_META.enriching.spinner).toBe(true);
    expect(ENRICHMENT_STATUS_META.retrying.spinner).toBe(true);
    expect(ENRICHMENT_STATUS_META.failed.spinner).toBe(false);
    expect(ENRICHMENT_STATUS_META.provisional.spinner).toBe(false);
  });
});
