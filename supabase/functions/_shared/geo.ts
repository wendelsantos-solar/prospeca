// PostGIS point helpers for Edge Functions.
//
// PostgREST returns `geography(point)` / `geometry(point)` columns as
// hex-encoded EWKB (e.g. "0101000020E6100000...") — NOT GeoJSON. This helper
// accepts either form and returns [longitude, latitude], so callers don't have
// to care how PostgREST serialized the value.

export function readPoint(value: unknown): [number, number] | null {
  if (value == null) return null;

  // Already GeoJSON ({ type: "Point", coordinates: [lng, lat] })
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
  // Minimum point: 1 (order) + 4 (type) + 16 (x,y) = 21 bytes = 42 hex chars.
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

  let offset = 5; // byte order (1) + type/flags (4)
  if (hasSrid) offset += 4; // SRID (4)

  if (offset + 16 > bytes.length) return null;
  const lng = dv.getFloat64(offset, littleEndian);
  const lat = dv.getFloat64(offset + 8, littleEndian);
  return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
}
