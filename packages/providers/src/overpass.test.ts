import { describe, expect, test } from "bun:test";
import {
  buildOverpassElementQuery,
  buildOverpassQuery,
  mapElement,
  OverpassPlacesProvider,
} from "./overpass";

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
  test("known category maps to tag selectors only (name union reverted)", () => {
    const q = buildOverpassQuery({
      query: "barbearia",
      latitude: 0,
      longitude: 0,
      radiusMeters: 1000,
    });
    expect(q).toContain("shop=hairdresser");
    expect(q).not.toContain('name~"barbearia",i');
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

describe("buildOverpassElementQuery", () => {
  test("builds an element-by-id query for a node", () => {
    expect(buildOverpassElementQuery("node/42")).toContain("node(42);");
  });
  test("builds for way and relation", () => {
    expect(buildOverpassElementQuery("way/7")).toContain("way(7);");
    expect(buildOverpassElementQuery("relation/9")).toContain("relation(9);");
  });
  test("returns null for a non-OSM id (e.g. a Google place id)", () => {
    expect(buildOverpassElementQuery("ChIJN1t_tDeuEmsRUsoyG83frY4")).toBeNull();
    expect(buildOverpassElementQuery("node/")).toBeNull();
    expect(buildOverpassElementQuery("42")).toBeNull();
  });
});

describe("OverpassPlacesProvider.getPlaceDetails", () => {
  const makeProvider = (fakeFetch: unknown) =>
    new OverpassPlacesProvider({
      baseUrl: "https://overpass.example/api/interpreter",
      userAgent: "leads-test/1.0",
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });

  test("fetches one element by id and maps it", async () => {
    const fakeFetch = async () =>
      new Response(
        JSON.stringify({
          elements: [
            {
              type: "node",
              id: 42,
              lat: -30.03,
              lon: -51.21,
              tags: { name: "Clínica São José", amenity: "clinic", phone: "+55 51 3321-4567" },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    const c = (await makeProvider(fakeFetch).getPlaceDetails("node/42"))!;
    expect(c.externalId).toBe("node/42");
    expect(c.phone).toBe("+55 51 3321-4567");
    expect(c.category).toBe("clinic");
  });

  test("returns null when Overpass finds no element", async () => {
    const fakeFetch = async () =>
      new Response(JSON.stringify({ elements: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    expect(await makeProvider(fakeFetch).getPlaceDetails("node/999")).toBeNull();
  });

  test("returns null for a non-OSM id without hitting the network", async () => {
    let called = false;
    const fakeFetch = async () => {
      called = true;
      return new Response("{}", { status: 200 });
    };
    expect(await makeProvider(fakeFetch).getPlaceDetails("ChIJxyz")).toBeNull();
    expect(called).toBe(false);
  });
});
