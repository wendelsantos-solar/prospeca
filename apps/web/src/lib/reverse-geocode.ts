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
