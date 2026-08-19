import { invokeFunction } from "@/lib/supabase";
import { isRealMode } from "@/lib/env";
import { geocodeLocal, reverseGeocodeLocal } from "@/lib/local-geocoding";

/**
 * Converte coordenadas em um label "Cidade, Estado". Usa a Edge Function
 * (Google) em modo real e cai para o geocoding local (cidade mais próxima)
 * em modo demo ou quando a rede falha.
 */
export async function reverseGeocodeCoords(lat: number, lng: number): Promise<string | null> {
  if (isRealMode) {
    try {
      const res = await invokeFunction<{ label: string }>("geocode-location", {
        latitude: lat,
        longitude: lng,
      });
      if (res.label) return res.label;
    } catch {
      // fall through to local
    }
  }
  return reverseGeocodeLocal(lat, lng);
}

/**
 * Resolve texto livre (cidade/bairro) em coordenadas. Em modo real tenta o
 * Google Geocoding e cai para a base local; em modo demo usa só a base local.
 * Nunca mais retorna null por "estar em demo" — a busca de região funciona
 * offline.
 */
export async function geocodeLocationText(
  query: string,
): Promise<{ label: string; latitude: number; longitude: number } | null> {
  if (isRealMode) {
    try {
      const res = await invokeFunction<{ label: string; latitude: number; longitude: number }>(
        "geocode-location",
        { query },
      );
      if (res) return res;
    } catch {
      // fall through to local
    }
  }
  return geocodeLocal(query);
}
