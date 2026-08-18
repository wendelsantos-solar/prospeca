import { describe, expect, test } from "bun:test";
import {
  buildHeatPoints,
  mixHex,
  interpolateHeatColor,
  hexToRgba,
  heatReasons,
  findNearbyCompanies,
  heatSummaryHtml,
} from "./opportunity-heatmap";
import type { DiscoveryResult } from "@leads/contracts";

function result(partial: Partial<DiscoveryResult>): DiscoveryResult {
  return {
    placeId: "p",
    name: "Empresa",
    category: null,
    latitude: -22.9,
    longitude: -43.1,
    address: null,
    neighborhood: null,
    city: null,
    state: null,
    phone: null,
    website: null,
    hasWebsite: false,
    email: null,
    instagram: null,
    whatsapp: null,
    rating: null,
    reviewCount: null,
    distanceKm: 0,
    score: 50,
    temperature: "warm",
    importedLeadId: null,
    enrichmentState: "pending",
    enrichmentFields: null,
    primaryCnae: null,
    cnaeDescription: null,
    secondaryCnaes: null,
    ...partial,
  };
}

describe("buildHeatPoints", () => {
  test("weight = score/100, clamped", () => {
    const pts = buildHeatPoints([result({ score: 84 }), result({ score: 120 })]);
    expect(pts.map((p) => p.weight)).toEqual([0.84, 1]);
  });

  test("drops non-opportunities (score 0)", () => {
    const pts = buildHeatPoints([result({ score: 0 }), result({ score: 60 })]);
    expect(pts).toHaveLength(1);
    expect(pts[0].weight).toBe(0.6);
  });

  test("drops points without valid coordinates", () => {
    const pts = buildHeatPoints([
      result({ latitude: NaN }),
      result({ longitude: Infinity }),
      result({ latitude: -22.9, longitude: -43.1, score: 70 }),
    ]);
    expect(pts).toHaveLength(1);
    expect(pts[0]).toEqual({ lat: -22.9, lng: -43.1, weight: 0.7 });
  });

  test("empty results → empty points", () => {
    expect(buildHeatPoints([])).toEqual([]);
  });
});

describe("color helpers", () => {
  test("mixHex midpoints", () => {
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mixHex("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mixHex("#000000", "#ffffff", 1)).toBe("#ffffff");
  });

  test("interpolateHeatColor clamps and picks stops", () => {
    const stops = ["#000000", "#808080", "#ffffff"];
    expect(interpolateHeatColor(0, stops)).toBe("#000000");
    expect(interpolateHeatColor(0.5, stops)).toBe("#808080");
    expect(interpolateHeatColor(1, stops)).toBe("#ffffff");
    expect(interpolateHeatColor(2, stops)).toBe("#ffffff"); // clamped
  });

  test("hexToRgba", () => {
    expect(hexToRgba("#64748b", 0.5)).toBe("rgba(100,116,139,0.5)");
  });
});

describe("heatReasons", () => {
  test("surfaces digital gap, contact and reputation", () => {
    const reasons = heatReasons(
      result({ hasWebsite: false, whatsapp: "+5511…", rating: 4.8, reviewCount: 50 }),
    );
    expect(reasons).toEqual(["Sem site", "WhatsApp", "Nota 4.8"]);
  });

  test("falls back to phone when no whatsapp", () => {
    expect(heatReasons(result({ hasWebsite: true, whatsapp: null, phone: "+55 11 9…" }))).toEqual([
      "Telefone",
    ]);
  });

  test("caps at 3 reasons", () => {
    const reasons = heatReasons(
      result({ hasWebsite: false, whatsapp: "x", rating: 4.9, reviewCount: 100 }),
    );
    expect(reasons).toHaveLength(3);
  });
});

describe("findNearbyCompanies", () => {
  test("returns companies within radius, best score first", () => {
    const res = [
      result({ placeId: "a", latitude: -22.9, longitude: -43.1, score: 80 }),
      result({ placeId: "b", latitude: -22.9, longitude: -43.1, score: 95 }),
      result({ placeId: "c", latitude: -23.5, longitude: -46.6, score: 99 }),
    ];
    expect(findNearbyCompanies(res, -22.9, -43.1).map((r) => r.placeId)).toEqual(["b", "a"]);
  });

  test("excludes companies beyond the radius", () => {
    const res = [result({ placeId: "far", latitude: -23.5, longitude: -46.6, score: 99 })];
    expect(findNearbyCompanies(res, -22.9, -43.1, 500)).toEqual([]);
  });
});

describe("heatSummaryHtml", () => {
  test("includes name, score and the why", () => {
    const html = heatSummaryHtml([
      result({ name: "Barbearia do Beto", score: 88, hasWebsite: false, whatsapp: "x" }),
    ]);
    expect(html).toContain("Barbearia do Beto");
    expect(html).toContain("88");
    expect(html).toContain("Sem site");
    expect(html).toContain("data-place-id");
  });

  test("escapes HTML in company names", () => {
    const html = heatSummaryHtml([result({ name: "<script>alert(1)</script>" })]);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
