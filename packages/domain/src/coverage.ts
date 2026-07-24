// Nivel 2 (coverage) cache geometry — the tested reference for the reuse rule.
// The RUNTIME path is the SQL `find_covering_cache` RPC (ST_Distance on
// geography) plus the haversine filter inlined in execute-search; this module
// mirrors that math so the containment inequality and the circle filter are
// unit-verified independently of the database.

export interface Circle {
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

/** Great-circle distance in meters (spherical earth, R=6371km). */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * True when `outer` fully contains `inner` on the sphere: the distance between
 * centers plus the inner radius fits inside the outer radius. This is the exact
 * predicate the SQL coverage lookup enforces (`ST_Distance(...) + reqRadius <=
 * radius_meters`), so a covering entry's payload can serve the inner request.
 */
export function circleContains(outer: Circle, inner: Circle): boolean {
  const d = haversineMeters(outer.latitude, outer.longitude, inner.latitude, inner.longitude);
  return d + inner.radiusMeters <= outer.radiusMeters;
}

/**
 * Filter a covering payload down to the requested circle. Points without
 * coordinates are kept (cannot be proven outside), matching execute-search's
 * fine radius cut.
 */
export function filterToCircle<T extends { latitude?: number | null; longitude?: number | null }>(
  points: T[],
  center: { latitude: number; longitude: number },
  radiusMeters: number,
): T[] {
  return points.filter((p) => {
    if (p.latitude == null || p.longitude == null) return true;
    return (
      haversineMeters(center.latitude, center.longitude, p.latitude, p.longitude) <= radiusMeters
    );
  });
}
