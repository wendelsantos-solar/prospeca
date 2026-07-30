// Geographic helpers — inlined from @leads/geo so edge functions bundle
// without needing the monorepo import map.

export const EARTH_RADIUS_M = 6371000;

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return Math.round(EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)));
}

export function haversineKm(a: LatLng, b: LatLng): number {
  return Number((haversineMeters(a, b) / 1000).toFixed(1));
}

export function isValidLatLng(p: LatLng): boolean {
  return (
    Number.isFinite(p.latitude) &&
    Number.isFinite(p.longitude) &&
    p.latitude >= -90 &&
    p.latitude <= 90 &&
    p.longitude >= -180 &&
    p.longitude <= 180
  );
}

export function boundingBox(center: LatLng, radiusMeters: number): BoundingBox {
  const latDelta = (radiusMeters / EARTH_RADIUS_M) * (180 / Math.PI);
  const cosLat = Math.cos((center.latitude * Math.PI) / 180);
  const lngDelta = cosLat <= 0 ? 180 : (radiusMeters / (EARTH_RADIUS_M * cosLat)) * (180 / Math.PI);
  return {
    south: Math.max(-90, center.latitude - latDelta),
    north: Math.min(90, center.latitude + latDelta),
    west: Math.max(-180, center.longitude - lngDelta),
    east: Math.min(180, center.longitude + lngDelta),
  };
}

export function readPoint(value: unknown): [number, number] | null {
  if (value == null) return null;

  if (typeof value === "object" && value !== null && "coordinates" in value) {
    const c = (value as { coordinates?: unknown }).coordinates;
    if (Array.isArray(c) && c.length >= 2) {
      const lng = Number(c[0]);
      const lat = Number(c[1]);
      return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
    }
    return null;
  }

  if (typeof value === "string") return decodeEwkbPoint(value);
  return null;
}

function decodeEwkbPoint(hex: string): [number, number] | null {
  const h = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
  if (h.length < 42 || h.length % 2 !== 0) return null;

  const bytes = new Uint8Array(h.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const b = parseInt(h.substr(i * 2, 2), 16);
    if (Number.isNaN(b)) return null;
    bytes[i] = b;
  }

  const dv = new DataView(bytes.buffer);
  const littleEndian = bytes[0] === 1;
  const typeAndFlags = dv.getUint32(1, littleEndian);
  const hasSrid = (typeAndFlags & 0x20000000) !== 0;

  let offset = 5;
  if (hasSrid) offset += 4;

  if (offset + 16 > bytes.length) return null;
  const lng = dv.getFloat64(offset, littleEndian);
  const lat = dv.getFloat64(offset + 8, littleEndian);
  return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
}

export function toWktPoint(p: LatLng): string | null {
  return isValidLatLng(p) ? `POINT(${p.longitude} ${p.latitude})` : null;
}
