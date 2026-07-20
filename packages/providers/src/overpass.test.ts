import { describe, expect, test } from "bun:test";
import { buildOverpassQuery, mapElement, OverpassPlacesProvider } from "./overpass";

describe("buildOverpassQuery", () => {
  test("maps known category to OSM selectors + around", () => {
    const q = buildOverpassQuery({
      query: "clinica medica",
      latitude: -30.0346,
      longitude: -51.2177,
      radiusMeters: 20000,
    });
    expect(q).toContain("[out:json]");
    expect(q).toContain("amenity=clinic");
    expect(q).toContain("(around:20000,-30.0346,-51.2177)");
    expect(q).toContain("out center tags;");
  });
  test("falls back to name match for unknown category", () => {
    const q = buildOverpassQuery({
      query: "Borracharia do Zé",
      latitude: 0,
      longitude: 0,
      radiusMeters: 1000,
    });
    expect(q).toContain('name~"Borracharia do Zé",i');
  });
});

describe("mapElement", () => {
  test("maps a node with tags to a BusinessCandidate", () => {
    const c = mapElement({
      type: "node",
      id: 42,
      lat: -30.03,
      lon: -51.21,
      tags: {
        name: "Clínica São José",
        amenity: "clinic",
        phone: "+55 51 3321-4567",
        website: "https://clinicasaojose.com.br",
        "addr:street": "Rua X",
        "addr:housenumber": "100",
        "addr:city": "Porto Alegre",
      },
    })!;
    expect(c.externalId).toBe("node/42");
    expect(c.source).toBe("overpass");
    expect(c.category).toBe("clinic");
    expect(c.phone).toBe("+55 51 3321-4567");
    expect(c.address).toBe("Rua X, 100 - Porto Alegre");
  });
  test("uses way center coords", () => {
    const c = mapElement({ type: "way", id: 7, center: { lat: 1, lon: 2 }, tags: { name: "X" } })!;
    expect(c.latitude).toBe(1);
    expect(c.longitude).toBe(2);
  });
  test("drops elements without name or coords", () => {
    expect(mapElement({ type: "node", id: 1, lat: 1, lon: 2, tags: {} })).toBeNull();
    expect(mapElement({ type: "node", id: 1, tags: { name: "X" } })).toBeNull();
  });
});

describe("OverpassPlacesProvider", () => {
  test("fetches, maps and dedupes by externalId (fake fetch, no network)", async () => {
    const fakeFetch = async () =>
      new Response(
        JSON.stringify({
          elements: [
            { type: "node", id: 1, lat: -30, lon: -51, tags: { name: "A", amenity: "clinic" } },
            { type: "node", id: 1, lat: -30, lon: -51, tags: { name: "A", amenity: "clinic" } },
            { type: "node", id: 2, lat: -30, lon: -51, tags: { name: "B", amenity: "doctors" } },
            { type: "node", id: 3, lat: -30, lon: -51, tags: {} }, // no name -> dropped
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    const provider = new OverpassPlacesProvider({
      baseUrl: "https://overpass.example/api/interpreter",
      userAgent: "leads-test/1.0",
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });
    const out = await provider.searchBusinesses({
      query: "clinica",
      latitude: -30,
      longitude: -51,
      radiusMeters: 5000,
    });
    expect(out.map((c) => c.externalId)).toEqual(["node/1", "node/2"]);
  });
});
