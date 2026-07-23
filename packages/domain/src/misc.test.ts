import { describe, expect, test } from "bun:test";
import { calculateScore, temperatureFromScore } from "./score";
import { geocodeCacheKey, placesCacheKey, roundCoord } from "./cache";
import { canTransition, isTerminal } from "./status";

describe("score", () => {
  test("no-website lead scores higher (opportunity)", () => {
    const s = calculateScore({
      hasWebsite: false,
      hasValidPhone: true,
      whatsappStatus: "possible",
      hasEmail: false,
      hasInstagram: false,
      hasCategory: false,
      rating: null,
      reviewCount: null,
      distanceMeters: 5000,
      businessStatus: "OPERATIONAL",
    });
    // v3.0.0: no_website 30 + valid_phone 20 + whatsapp 12 + nearby_5 8 = 70
    expect(s.total).toBe(30 + 20 + 12 + 8);
    expect(s.ruleVersion).toBe("v3.0.0");
  });
  test("clamped to 0..100 and temperature bands", () => {
    expect(temperatureFromScore(80)).toBe("hot");
    expect(temperatureFromScore(50)).toBe("warm");
    expect(temperatureFromScore(10)).toBe("cold");
  });
});

describe("cache keys", () => {
  test("nearby coords bucket to the same places key", () => {
    const k1 = placesCacheKey({
      provider: "google_places",
      category: "clinica medica",
      latitude: -30.03461,
      longitude: -51.21772,
      radiusMeters: 20000,
    });
    const k2 = placesCacheKey({
      provider: "google_places",
      category: "clínica médica",
      latitude: -30.03459,
      longitude: -51.21769,
      radiusMeters: 20000,
    });
    expect(k1).toBe(k2);
    expect(k1.startsWith("v4:places:google_places:clinica_medica:")).toBe(true);
  });
  test("roundCoord precision", () => {
    expect(roundCoord(-51.21772, 3)).toBe(-51.218);
  });
  test("geocode key is namespaced + slugged", () => {
    expect(geocodeCacheKey({ provider: "google_geocoding", query: "Porto Alegre, RS" })).toBe(
      "v4:geocode:google_geocoding:porto_alegre_rs",
    );
  });
});

describe("status machine", () => {
  test("valid transitions", () => {
    expect(canTransition("queued", "geocoding")).toBe(true);
    expect(canTransition("importing", "completed")).toBe(true);
  });
  test("invalid transitions", () => {
    expect(canTransition("completed", "searching")).toBe(false);
    expect(canTransition("queued", "completed")).toBe(false);
  });
  test("terminal detection", () => {
    expect(isTerminal("completed")).toBe(true);
    expect(isTerminal("queued")).toBe(false);
  });
});
