// Shared map info-window markup + action wiring, used by both the Leaflet and
// the Google Maps renderers so the popup and its buttons behave identically.
import type { DiscoveryResult } from "@/repositories/types";
import { TEMPERATURE_LABELS } from "@/lib/constants";
import { categoryLabel } from "@/lib/category";

export function channelIcons(r: DiscoveryResult): string {
  const parts: string[] = [];
  if (r.phone) parts.push("📞");
  if (r.hasWebsite) parts.push("🌐");
  return parts.join(" ");
}

export function popupHtml(r: DiscoveryResult): string {
  const inFunnel = r.importedLeadId != null;
  const funnelBtn = inFunnel
    ? `<button disabled style="flex:1;padding:4px 8px;border-radius:6px;background:oklch(0.9 0.02 155);color:oklch(0.45 0.05 155);font-size:11px;border:none;">No funil ✓</button>`
    : `<button data-action="funnel" data-id="${r.placeId}" style="flex:1;padding:4px 8px;border-radius:6px;background:oklch(0.62 0.16 245);color:white;font-size:11px;border:none;cursor:pointer;">+ Funil</button>`;
  return `
    <div style="min-width:220px;font-family:inherit;">
      <div style="font-weight:600;font-size:13px;">${r.name}</div>
      <div style="color:#666;font-size:11px;margin-bottom:6px;">${categoryLabel(r.category)}</div>
      <div style="font-size:11px;margin-bottom:2px;">
        <b>${TEMPERATURE_LABELS[r.temperature]}</b> • Score <b>${r.score}</b> • Nota <b>${r.rating?.toFixed(1) ?? "—"}</b> (${r.reviewCount ?? 0})
      </div>
      <div style="font-size:11px;color:#666;">${r.phone ?? ""} • ${r.distanceKm.toFixed(1)} km • ${r.hasWebsite ? "Com site" : "<b style='color:oklch(0.72 0.17 55)'>Sem site</b>"}</div>
      <div style="font-size:12px;margin-top:4px;">${channelIcons(r)}</div>
      <div style="margin-top:8px;display:flex;gap:4px;">
        <button data-action="whatsapp" data-id="${r.placeId}" style="flex:1;padding:4px 8px;border-radius:6px;background:oklch(0.62 0.15 155);color:white;font-size:11px;border:none;cursor:pointer;">WhatsApp</button>
        ${funnelBtn}
      </div>
      <div style="margin-top:4px;">
        <button data-action="details" data-id="${r.placeId}" style="width:100%;padding:4px 8px;border-radius:6px;background:transparent;color:oklch(0.5 0.02 250);font-size:11px;border:1px solid oklch(0.85 0.02 250);cursor:pointer;">Ver detalhes</button>
      </div>
    </div>`;
}

/** Marker/cluster fill colors as hex (SVG data-URI icons can't rely on oklch). */
export const MARKER_HEX = {
  hot: "#f97316",
  warm: "#eab308",
  cold: "#64748b",
  funnel: "#16a34a",
  selected: "#2563eb",
} as const;

export function markerColor(r: DiscoveryResult, selected: boolean): string {
  if (selected) return MARKER_HEX.selected;
  if (r.importedLeadId != null) return MARKER_HEX.funnel;
  return MARKER_HEX[r.temperature];
}
