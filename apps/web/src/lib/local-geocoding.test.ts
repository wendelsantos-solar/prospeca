import { describe, expect, test } from "bun:test";
import { geocodeLocal, reverseGeocodeLocal, suggestCities } from "./local-geocoding";

describe("geocodeLocal", () => {
  test("exact city name, case/accent-insensitive", () => {
    expect(geocodeLocal("porto alegre")?.label).toBe("Porto Alegre, Rio Grande do Sul");
    expect(geocodeLocal("SÃO PAULO")?.label).toBe("São Paulo, São Paulo");
    expect(geocodeLocal("sao paulo, sao paulo")?.label).toBe("São Paulo, São Paulo");
  });

  test("prefix match", () => {
    expect(geocodeLocal("campin")?.label).toBe("Campinas, São Paulo");
  });

  test("returns null for garbage / too-short", () => {
    expect(geocodeLocal("")).toBeNull();
    expect(geocodeLocal("x")).toBeNull();
    expect(geocodeLocal("zzzzzz")).toBeNull();
  });
});

describe("suggestCities", () => {
  test("returns top cities when empty", () => {
    const s = suggestCities("");
    expect(s.length).toBeGreaterThan(0);
    expect(s.length).toBeLessThanOrEqual(8);
  });

  test("filters by query", () => {
    const s = suggestCities("porto");
    expect(s.some((c) => c.label.includes("Porto"))).toBe(true);
  });
});

describe("reverseGeocodeLocal", () => {
  test("returns nearest city label", () => {
    // Near São Paulo centre.
    expect(reverseGeocodeLocal(-23.55, -46.64)).toBe("São Paulo, São Paulo");
    // Near Rio centre.
    expect(reverseGeocodeLocal(-22.9, -43.17)).toBe("Rio de Janeiro, Rio de Janeiro");
  });
});
