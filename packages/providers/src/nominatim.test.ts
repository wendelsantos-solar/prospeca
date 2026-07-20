import { describe, expect, test } from "bun:test";
import { NominatimGeocodingProvider } from "./nominatim";

function fakeFetch(payload: unknown, capture?: (url: string) => void) {
  return async (url: string | URL | Request) => {
    capture?.(String(url));
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
}

describe("NominatimGeocodingProvider", () => {
  test("geocode maps first result", async () => {
    let calledUrl = "";
    const provider = new NominatimGeocodingProvider({
      baseUrl: "https://nominatim.example",
      userAgent: "leads-test/1.0",
      fetchImpl: fakeFetch(
        [{ lat: "-30.0346", lon: "-51.2177", display_name: "Porto Alegre, RS, Brasil" }],
        (u) => (calledUrl = u),
      ) as unknown as typeof fetch,
    });
    const r = await provider.geocode({ query: "Porto Alegre, RS", countryCode: "BR" });
    expect(r).toEqual({
      latitude: -30.0346,
      longitude: -51.2177,
      formattedAddress: "Porto Alegre, RS, Brasil",
      provider: "nominatim",
    });
    expect(calledUrl).toContain("/search");
    expect(calledUrl).toContain("countrycodes=br");
  });

  test("geocode returns null on empty", async () => {
    const provider = new NominatimGeocodingProvider({
      baseUrl: "https://nominatim.example",
      userAgent: "t/1",
      fetchImpl: fakeFetch([]) as unknown as typeof fetch,
    });
    expect(await provider.geocode({ query: "nowhere" })).toBeNull();
  });

  test("reverse returns null when error field present", async () => {
    const provider = new NominatimGeocodingProvider({
      baseUrl: "https://nominatim.example",
      userAgent: "t/1",
      fetchImpl: fakeFetch({ error: "Unable to geocode" }) as unknown as typeof fetch,
    });
    expect(await provider.reverse({ latitude: 0, longitude: 0 })).toBeNull();
  });
});
