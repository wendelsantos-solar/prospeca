import type { DiscoveryResult } from "@leads/contracts";
import { heatMetricWeight, type HeatMetric } from "@leads/domain";

export interface HeatPoint {
  lat: number;
  lng: number;
  /** Opportunity intensity in [0, 1]. Drives the heat of this point. */
  weight: number;
}

/**
 * The heatmap represents **opportunity density**, not raw company count: each
 * point contributes its opportunity score as heat. The score already folds in
 * the signals the product cares about — digital presence (no site = +30),
 * reachability (phone/WhatsApp) and reputation — so "a region with many
 * high-score businesses" and "a region full of no-site businesses" both read
 * as hot, exactly the commercial insight the heatmap is meant to surface.
 *
 * Non-opportunities (score 0, e.g. non-operational businesses) are dropped so
 * they never cool the map.
 */
export function buildHeatPoints(
  results: DiscoveryResult[],
  metric: HeatMetric = "opportunity",
): HeatPoint[] {
  const points: HeatPoint[] = [];
  for (const r of results) {
    if (!Number.isFinite(r.latitude) || !Number.isFinite(r.longitude)) continue;
    const weight = heatMetricWeight(metric, { score: r.score ?? 0, hasWebsite: r.hasWebsite });
    if (weight <= 0) continue;
    points.push({ lat: r.latitude, lng: r.longitude, weight });
  }
  return points;
}

// ── Rendering helpers (pure, shared by the custom canvas overlays) ──────

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Mix two #rrggbb colors; t ∈ [0,1] (0 = a, 1 = b). */
export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  const mix = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `#${[mix(ar, br), mix(ag, bg), mix(ab, bb)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Interpolate a weight (0..1) across an ordered array of color stops
 * (e.g. [cold, warm, hot]) — the same ramp both renderers use. */
export function interpolateHeatColor(weight: number, stops: string[]): string {
  if (stops.length === 0) return "#000000";
  if (stops.length === 1) return stops[0];
  const t = Math.max(0, Math.min(1, weight));
  const idx = t * (stops.length - 1);
  const i = Math.min(Math.floor(idx), stops.length - 2);
  return mixHex(stops[i], stops[i + 1], idx - i);
}

/** #rrggbb + alpha → rgba() string. */
export function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── "Por que esta zona é quente?" (heatmap explicável) ─────────────────────

const TEMP_LABEL: Record<string, string> = { hot: "Quente", warm: "Morno", cold: "Frio" };

/**
 * Compact, human-readable signals that make a company read as high-opportunity.
 * These are the same drivers the full score uses (digital gap, reachability,
 * reputation) — surfaced so the heatmap answers "why is this hot?", not just
 * "this is hot".
 */
export function heatReasons(r: DiscoveryResult): string[] {
  const reasons: string[] = [];
  if (!r.hasWebsite) reasons.push("Sem site");
  if (r.whatsapp) reasons.push("WhatsApp");
  else if (r.phone) reasons.push("Telefone");
  if (r.rating != null && r.rating >= 4.5) reasons.push(`Nota ${r.rating}`);
  if (r.reviewCount != null && r.reviewCount >= 20) reasons.push(`${r.reviewCount} avaliações`);
  return reasons.slice(0, 3);
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Companies within `radiusMeters` of a click, best score first — the data
 * behind a heat blob. */
export function findNearbyCompanies(
  results: DiscoveryResult[],
  lat: number,
  lng: number,
  radiusMeters = 500,
  limit = 5,
): DiscoveryResult[] {
  return results
    .filter((r) => {
      if (!Number.isFinite(r.latitude) || !Number.isFinite(r.longitude)) return false;
      return haversineMeters(lat, lng, r.latitude, r.longitude) <= radiusMeters;
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

/** InfoWindow markup for a clicked heat zone: the top companies, their score,
 * temperature and the signals that explain why they are hot. */
export function heatSummaryHtml(companies: DiscoveryResult[]): string {
  const items = companies
    .map((c) => {
      const reasons = heatReasons(c);
      const temp = TEMP_LABEL[c.temperature ?? "cold"] ?? "";
      const meta = [`${c.score ?? ""}`];
      if (temp) meta.push(temp);
      return `<li style="padding:5px 0;border-bottom:1px solid rgba(120,120,120,.18)">
        <button type="button" data-place-id="${c.placeId}" style="display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;background:none;border:none;cursor:pointer;text-align:left;padding:0;font:inherit">
          <span style="font-size:13px;font-weight:600">${escapeHtml(c.name)}</span>
          <span style="font-size:12px;font-weight:700;white-space:nowrap">${meta.join(" · ")}</span>
        </button>
        ${
          reasons.length
            ? `<small style="display:block;margin-top:1px;font-size:11px;color:#6b7280">${escapeHtml(reasons.join(" · "))}</small>`
            : ""
        }
      </li>`;
    })
    .join("");
  const n = companies.length;
  return `<div style="font-family:system-ui,-apple-system,sans-serif;min-width:230px;max-width:300px;padding:2px">
    <div style="font-size:13px;font-weight:700;margin-bottom:4px">🔥 ${n} empresa${n === 1 ? "" : "s"} de alta oportunidade</div>
    <ul style="list-style:none;margin:0;padding:0">${items}</ul>
    <div style="font-size:11px;color:#6b7280;margin-top:5px">Toque numa empresa para ver os detalhes</div>
  </div>`;
}
