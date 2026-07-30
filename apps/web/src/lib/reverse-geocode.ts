import { invokeFunction } from "@/lib/supabase";
import { isRealMode } from "@/lib/env";

/**
 * Converte coordenadas em um label "Bairro, Cidade" via Edge Function (Google).
 * Retorna null em modo demo ou se a resolução falhar — o chamador decide o fallback.
 */
export async function reverseGeocodeCoords(lat: number, lng: number): Promise<string | null> {
  if (!isRealMode) return null;
  try {
    const res = await invokeFunction<{ label: string }>("geocode-location", {
      latitude: lat,
      longitude: lng,
    });
    return res.label ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve texto livre (rua, bairro, cidade — qualquer coisa que o Google
 * Geocoding aceite) em coordenadas, via a mesma Edge Function/cache do
 * reverse geocode. `null` cobre tanto "não encontrado" quanto erro de rede —
 * o chamador mostra um toast genérico nos dois casos.
 */
export async function geocodeLocationText(
  query: string,
): Promise<{ label: string; latitude: number; longitude: number } | null> {
  if (!isRealMode) return null;
  try {
    return await invokeFunction<{ label: string; latitude: number; longitude: number }>(
      "geocode-location",
      { query },
    );
  } catch {
    return null;
  }
}
