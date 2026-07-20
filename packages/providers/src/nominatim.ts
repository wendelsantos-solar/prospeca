// NominatimGeocodingProvider — OSM-based geocoding. Implements GeocodingProvider.
// Respect OSM usage policy: set a real User-Agent, keep volume low, cache results.
import type { GeocodeResult, GeocodingProvider } from "@leads/contracts";
import { requestJson, type HttpOptions } from "./http";

export interface NominatimConfig {
  baseUrl: string; // e.g. https://nominatim.openstreetmap.org
  userAgent: string; // required by OSM usage policy
  timeoutMs?: number;
  maxRetries?: number;
  fetchImpl?: HttpOptions["fetchImpl"];
}

interface NominatimPlace {
  lat: string;
  lon: string;
  display_name: string;
}

export class NominatimGeocodingProvider implements GeocodingProvider {
  readonly name = "nominatim";
  constructor(private readonly config: NominatimConfig) {}

  private httpOpts(): HttpOptions {
    return {
      fetchImpl: this.config.fetchImpl,
      timeoutMs: this.config.timeoutMs ?? 10000,
      maxRetries: this.config.maxRetries ?? 2,
      userAgent: this.config.userAgent,
    };
  }

  async geocode(input: { query: string; countryCode?: string }): Promise<GeocodeResult | null> {
    const url = new URL("/search", this.config.baseUrl);
    url.searchParams.set("q", input.query);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("addressdetails", "0");
    if (input.countryCode) url.searchParams.set("countrycodes", input.countryCode.toLowerCase());

    const data = await requestJson<NominatimPlace[]>({ url: url.toString() }, this.httpOpts());
    const first = data?.[0];
    if (!first) return null;
    return {
      latitude: Number(first.lat),
      longitude: Number(first.lon),
      formattedAddress: first.display_name,
      provider: this.name,
    };
  }

  async reverse(input: { latitude: number; longitude: number }): Promise<GeocodeResult | null> {
    const url = new URL("/reverse", this.config.baseUrl);
    url.searchParams.set("lat", String(input.latitude));
    url.searchParams.set("lon", String(input.longitude));
    url.searchParams.set("format", "jsonv2");

    const data = await requestJson<NominatimPlace & { error?: string }>(
      { url: url.toString() },
      this.httpOpts(),
    );
    if (!data || (data as { error?: string }).error || !data.display_name) return null;
    return {
      latitude: input.latitude,
      longitude: input.longitude,
      formattedAddress: data.display_name,
      provider: this.name,
    };
  }
}
