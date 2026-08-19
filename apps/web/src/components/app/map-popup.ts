// Shared map info-window markup + action wiring, used by both the Leaflet and
// the Google Maps renderers so the popup and its buttons behave identically.
import type { DiscoveryResult } from "@/repositories/types";
import { TEMPERATURE_LABELS } from "@/lib/constants";
import { categoryLabel } from "@/lib/category";

/** Temperature → ring color token. */
const RING_VAR: Record<DiscoveryResult["temperature"], string> = {
  hot: "var(--color-hot)",
  warm: "var(--color-warm)",
  cold: "var(--color-cold)",
};

function esc(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );
}

/** Rich map info-window matching the discovery card language: a temperature-
 * tinted score dial, a compact stats row, and the same actions. Rendered as raw
 * HTML into the Leaflet/Google popup, so it styles through CSS variables (which
 * resolve from :root/.dark in the document) rather than Tailwind classes. */
export function popupHtml(r: DiscoveryResult): string {
  const inFunnel = r.importedLeadId != null;
  const score = Math.max(0, Math.min(100, r.score));
  const ring = RING_VAR[r.temperature];
  const presence = r.hasWebsite
    ? `<div style="font-size:14px;font-weight:700;margin-top:2px;color:var(--color-foreground)">Presente</div>`
    : `<div style="font-size:14px;font-weight:700;margin-top:2px;color:var(--color-hot)">Baixa</div>`;

  const stat = (k: string, v: string) => `
    <div style="flex:1;background:var(--color-surface-2);border-radius:8px;padding:7px 9px;text-align:left;">
      <div style="font-size:10px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--color-muted-foreground)">${k}</div>
      ${v}
    </div>`;

  const funnelBtn = inFunnel
    ? `<span style="flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 10px;height:34px;border-radius:8px;background:var(--color-primary-soft);color:var(--color-primary);font-size:12.5px;font-weight:600;">No funil ${CHECK_SVG}</span>`
    : `<button data-action="funnel" data-id="${r.placeId}" style="flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 10px;height:34px;border-radius:8px;background:var(--color-primary);color:var(--color-primary-foreground);font-size:12.5px;font-weight:600;border:none;cursor:pointer;">+ Adicionar ao funil</button>`;

  return `
    <div style="min-width:248px;font-family:inherit;color:var(--color-foreground);">
      <div style="display:flex;gap:11px;align-items:flex-start;padding:2px 2px 11px;">
        <div style="position:relative;flex:0 0 40px;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(${ring} ${score}%, var(--color-border) 0);">
          <div style="position:absolute;inset:3px;border-radius:50%;background:var(--color-surface);"></div>
          <span style="position:relative;font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;">${score}</span>
        </div>
        <div style="min-width:0;">
          <div style="font-weight:600;font-size:13.5px;letter-spacing:-.01em;">${esc(r.name)}</div>
          <div style="color:var(--color-muted-foreground);font-size:11.5px;margin-top:2px;">
            ${esc(categoryLabel(r.category))} · ${TEMPERATURE_LABELS[r.temperature]}${r.distanceKm != null ? ` · ${r.distanceKm.toFixed(1)} km` : ""}
          </div>
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:11px;">
        ${stat("Avaliação", `<div style="font-size:14px;font-weight:700;margin-top:2px;font-variant-numeric:tabular-nums;">${r.rating?.toFixed(1) ?? "—"}</div>`)}
        ${stat("Reviews", `<div style="font-size:14px;font-weight:700;margin-top:2px;font-variant-numeric:tabular-nums;">${r.reviewCount ?? 0}</div>`)}
        ${stat("Presença", presence)}
      </div>

      <div style="display:flex;gap:7px;">
        ${funnelBtn}
        <button data-action="whatsapp" data-id="${r.placeId}" title="Preparar WhatsApp" aria-label="Preparar WhatsApp" style="flex:0 0 34px;width:34px;height:34px;border-radius:8px;background:var(--color-surface);border:1px solid var(--color-border);color:var(--color-secondary-foreground);cursor:pointer;display:grid;place-items:center;">
          ${WHATSAPP_SVG}
        </button>
        <button data-action="details" data-id="${r.placeId}" title="Ver detalhes" aria-label="Ver detalhes" style="flex:0 0 34px;width:34px;height:34px;border-radius:8px;background:var(--color-surface);border:1px solid var(--color-border);color:var(--color-secondary-foreground);cursor:pointer;display:grid;place-items:center;">
          ${DETAILS_SVG}
        </button>
      </div>
    </div>`;
}

// Static SVG icons reused across every popup — extracting avoids recreating
// the same markup string on each of the 60+ popups per search.
const CHECK_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;flex-shrink:0;"><polyline points="20 6 9 17 4 12"/></svg>';
const WHATSAPP_SVG =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20l1.5-4A8 8 0 1 1 9 19z"/></svg>';
const DETAILS_SVG =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

/** Marker/cluster fill colors as hex (SVG data-URI icons can't rely on oklch). */
export const MARKER_HEX = {
  hot: "#f97316",
  warm: "#eab308",
  cold: "#64748b",
  funnel: "#16a34a",
  selected: "#2563eb",
} as const;

/** Opportunity-density heatmap gradient — a real thermal ramp (cool → hot), not
 * the marker temperature colors: low density reads as cool blue (≈ "Frio") and
 * high density as hot orange (≈ "Quente"), which is both the universal heatmap
 * convention and consistent with the product's temperature language. Shared by
 * the Leaflet (object stops) and Google (array) renderers so the heat reads the
 * same on both. */
export const HEAT_GRADIENT: Record<number, string> = {
  0.0: "#2563eb", // frio → azul
  0.45: "#22c55e", // médio → verde
  0.75: "#eab308", // morno → amarelo
  0.9: "#f97316", // quente → laranja
  1.0: "#dc2626", // muito quente → vermelho (maior oportunidade)
};
export const HEAT_GRADIENT_ARRAY: string[] = [
  "#2563eb",
  "#22c55e",
  "#eab308",
  "#f97316",
  "#dc2626",
];

/** CSS linear-gradient for the heatmap legend bar, built from the same thermal
 * stops the renderers use, so the legend always matches the actual heat. */
export const HEAT_GRADIENT_CSS = `linear-gradient(to right, ${HEAT_GRADIENT_ARRAY.join(", ")})`;

export function markerColor(r: DiscoveryResult, selected: boolean): string {
  if (selected) return MARKER_HEX.selected;
  if (r.importedLeadId != null) return MARKER_HEX.funnel;
  return MARKER_HEX[r.temperature];
}

export interface MarkerVisual {
  color: string;
  ring: string;
  size: number;
  zIndex: number;
}

/** Single source of truth for marker appearance — used by both the Google and
 * the Leaflet renderer so a "selected" marker looks and behaves identically
 * (scaled up, ringed, raised above its neighbors), not just recolored. */
export function markerVisual(r: DiscoveryResult, selected: boolean): MarkerVisual {
  const inFunnel = r.importedLeadId != null;
  return {
    color: markerColor(r, selected),
    ring: selected ? MARKER_HEX.selected : inFunnel ? MARKER_HEX.funnel : "#ffffff",
    size: selected ? 32 : 26,
    zIndex: selected ? 1000 : 1,
  };
}
