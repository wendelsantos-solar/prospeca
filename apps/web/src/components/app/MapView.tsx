import { useEffect, useRef, useMemo, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import type { Lead } from "@/types";
import { useLeadsStore, useSearchDraftStore } from "@/stores";
import { distanceKm } from "@/lib/geo";
import { useMoveLeadMutation } from "@/hooks/useLeadsQuery";
import { Button } from "@/components/ui/button";
import { Crosshair, ZoomIn, Circle as CircleIcon, Moon, Loader2 } from "lucide-react";
import { TEMPERATURE_LABELS } from "@/lib/constants";
import { env } from "@/lib/env";
import { toast } from "sonner";

const tempColor: Record<Lead["temperature"], string> = {
  hot: "oklch(0.72 0.17 55)",
  warm: "oklch(0.83 0.15 90)",
  cold: "oklch(0.72 0.04 250)",
};

function markerIcon(lead: Lead, selected: boolean) {
  const color =
    lead.stage === "won"
      ? "oklch(0.62 0.15 155)"
      : lead.stage === "discarded"
        ? "oklch(0.60 0.22 27)"
        : selected
          ? "oklch(0.62 0.16 245)"
          : tempColor[lead.temperature];
  const html = `<div style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:${color};color:#fff;font-size:11px;font-weight:600;box-shadow:0 2px 6px rgba(0,0,0,0.25);border:2px solid white;">${lead.score}</div>`;
  return L.divIcon({ html, className: "lead-marker", iconSize: [26, 26], iconAnchor: [13, 13] });
}

function channelIcons(l: Lead) {
  const parts: string[] = [];
  if (l.whatsapp) parts.push("💬");
  if (l.phone) parts.push("📞");
  if (l.instagram) parts.push("📷");
  if (l.email) parts.push("✉️");
  if (l.hasWebsite) parts.push("🌐");
  return parts.join(" ");
}

function popupHtml(l: Lead) {
  return `
    <div style="min-width:220px;font-family:inherit;">
      <div style="font-weight:600;font-size:13px;">${l.companyName}</div>
      <div style="color:#666;font-size:11px;margin-bottom:6px;">${l.category} • ${l.neighborhood ?? l.city}</div>
      <div style="font-size:11px;margin-bottom:2px;">
        <b>${TEMPERATURE_LABELS[l.temperature]}</b> • Score <b>${l.score}</b> • Nota <b>${l.rating?.toFixed(1) ?? "—"}</b> (${l.reviewCount ?? 0})
      </div>
      <div style="font-size:11px;color:#666;">${l.address}</div>
      <div style="font-size:11px;color:#666;">${l.phone ?? ""} • ${l.distanceKm.toFixed(1)} km • ${l.hasWebsite ? "Com site" : "<b style='color:oklch(0.72 0.17 55)'>Sem site</b>"}</div>
      <div style="font-size:12px;margin-top:4px;">${channelIcons(l)}</div>
      <div style="margin-top:8px;display:flex;gap:4px;">
        <button data-action="whatsapp" data-id="${l.id}" style="flex:1;padding:4px 8px;border-radius:6px;background:oklch(0.62 0.15 155);color:white;font-size:11px;border:none;cursor:pointer;">WhatsApp</button>
        <button data-action="details" data-id="${l.id}" style="flex:1;padding:4px 8px;border-radius:6px;background:oklch(0.58 0.14 155);color:white;font-size:11px;border:none;cursor:pointer;">Detalhes</button>
        <button data-action="funnel" data-id="${l.id}" style="flex:1;padding:4px 8px;border-radius:6px;background:oklch(0.62 0.16 245);color:white;font-size:11px;border:none;cursor:pointer;">+ Funil</button>
      </div>
    </div>`;
}

export function MapView({ leads }: { leads: Lead[] }) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const centerRef = useRef<L.Marker | null>(null);
  const currentSearch = useLeadsStore((s) => s.currentSearch);
  const previewLocation = useLeadsStore((s) => s.previewLocation);
  const draft = useSearchDraftStore((s) => s.draft);
  const focusedId = useLeadsStore((s) => s.focusedId);
  const setFocused = useLeadsStore((s) => s.setFocused);
  const setDetails = useLeadsStore((s) => s.setDetails);
  const searching = useLeadsStore((s) => s.searching);
  const moveMutation = useMoveLeadMutation();
  const [showCircle, setShowCircle] = useState(true);
  const [mapDark, setMapDark] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [visibleCount, setVisibleCount] = useState(leads.length);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    try {
      const map = L.map(containerRef.current, {
        zoomControl: true,
        // Attribution is mandatory per tile provider TOS — always on.
        attributionControl: true,
      }).setView([currentSearch?.latitude ?? -30.0346, currentSearch?.longitude ?? -51.2177], 13);
      // Tile source is configurable (VITE_MAP_TILE_URL) — no hardcoded provider.
      const tiles = L.tileLayer(env.mapTileUrl, {
        maxZoom: 19,
        attribution: env.mapAttribution,
      });
      tiles.on("tileerror", () => setMapError(true));
      tiles.on("load", () => {
        setMapReady(true);
        setMapError(false);
      });
      tiles.addTo(map);
      const cluster = L.markerClusterGroup({
        maxClusterRadius: 48,
        showCoverageOnHover: false,
        iconCreateFunction: (c) =>
          L.divIcon({
            html: `<div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:oklch(0.58 0.14 155);color:#fff;font-size:12px;font-weight:700;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);">${c.getChildCount()}</div>`,
            className: "lead-cluster",
            iconSize: [34, 34],
          }),
      });
      map.addLayer(cluster);
      clusterRef.current = cluster;
      const updateVisible = () => {
        const bounds = map.getBounds();
        let count = 0;
        markersRef.current.forEach((m) => {
          if (bounds.contains(m.getLatLng())) count++;
        });
        setVisibleCount(count);
      };
      map.on("moveend zoomend", updateVisible);
      mapRef.current = map;
      return () => {
        map.remove();
        mapRef.current = null;
        clusterRef.current = null;
      };
    } catch {
      setMapError(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !currentSearch) return;
    map.setView([currentSearch.latitude, currentSearch.longitude], 13);
    if (circleRef.current) {
      map.removeLayer(circleRef.current);
      circleRef.current = null;
    }
    if (showCircle) {
      circleRef.current = L.circle([currentSearch.latitude, currentSearch.longitude], {
        radius: currentSearch.radiusKm * 1000,
        color: "oklch(0.58 0.14 155)",
        fillColor: "oklch(0.58 0.14 155)",
        fillOpacity: 0.06,
        weight: 1.5,
      }).addTo(map);
    }
    if (centerRef.current) map.removeLayer(centerRef.current);
    centerRef.current = L.marker([currentSearch.latitude, currentSearch.longitude], {
      icon: L.divIcon({
        html: '<div style="width:12px;height:12px;border-radius:50%;background:oklch(0.58 0.14 155);border:2px solid white;box-shadow:0 0 0 3px oklch(0.58 0.14 155 / 0.25);"></div>',
        className: "",
        iconSize: [12, 12],
      }),
    }).addTo(map);
  }, [currentSearch, showCircle]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || currentSearch || !previewLocation) return;
    const { lat, lng, radiusKm } = previewLocation;
    map.setView([lat, lng], 13);
    if (circleRef.current) {
      map.removeLayer(circleRef.current);
      circleRef.current = null;
    }
    if (showCircle) {
      circleRef.current = L.circle([lat, lng], {
        radius: radiusKm * 1000,
        color: "oklch(0.58 0.14 155)",
        fillColor: "oklch(0.58 0.14 155)",
        fillOpacity: 0.06,
        weight: 1.5,
      }).addTo(map);
    }
    if (centerRef.current) map.removeLayer(centerRef.current);
    centerRef.current = L.marker([lat, lng], {
      icon: L.divIcon({
        html: '<div style="width:12px;height:12px;border-radius:50%;background:oklch(0.58 0.14 155);border:2px solid white;box-shadow:0 0 0 3px oklch(0.58 0.14 155 / 0.25);"></div>',
        className: "",
        iconSize: [12, 12],
      }),
    }).addTo(map);
  }, [previewLocation, currentSearch, showCircle]);

  // Live draft circle: redraws while the user drags the radius slider / edits
  // location, before any (paid) search runs. Cheap, client-only.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !showCircle) return;
    const center: [number, number] = [draft.coords.lat, draft.coords.lng];
    if (circleRef.current) {
      circleRef.current.setLatLng(center);
      circleRef.current.setRadius(draft.radiusKm * 1000);
    } else {
      circleRef.current = L.circle(center, {
        radius: draft.radiusKm * 1000,
        color: "oklch(0.58 0.14 155)",
        fillColor: "oklch(0.58 0.14 155)",
        fillOpacity: 0.06,
        weight: 1.5,
      }).addTo(map);
    }
  }, [draft.coords.lat, draft.coords.lng, draft.radiusKm, showCircle]);

  useEffect(() => {
    const map = mapRef.current;
    const cluster = clusterRef.current;
    if (!map || !cluster) return;
    cluster.clearLayers();
    markersRef.current.clear();
    leads.forEach((l) => {
      const m = L.marker([l.latitude, l.longitude], { icon: markerIcon(l, l.id === focusedId) }).on(
        "click",
        () => setFocused(l.id),
      );
      const within =
        distanceKm(draft.coords, { lat: l.latitude, lng: l.longitude }) <= draft.radiusKm;
      m.setOpacity(within ? 1 : 0.25);
      m.bindPopup(popupHtml(l));
      m.on("popupopen", () => {
        // Use event delegation on the popup container — more reliable than
        // setTimeout + querySelectorAll which races with Leaflet's DOM updates.
        const popupEl = m.getPopup()?.getElement();
        if (!popupEl) return;
        const handler = (e: Event) => {
          const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(
            "[data-action][data-id]",
          );
          if (!btn) return;
          e.preventDefault();
          const id = btn.dataset.id!;
          const action = btn.dataset.action;
          const lead = leads.find((x) => x.id === id);
          if (!lead) return;
          if (action === "details") setDetails(id);
          if (action === "whatsapp") {
            const num = (lead.whatsapp ?? lead.phone ?? "").replace(/\D/g, "");
            if (num) window.open(`https://wa.me/${num}`, "_blank");
            else toast.error("Sem WhatsApp/telefone");
          }
          if (action === "funnel") {
            moveMutation.mutate({ id, input: { toStage: "qualified" } });
            toast.success("Lead adicionado ao funil como Qualificado");
          }
        };
        popupEl.addEventListener("click", handler);
        // Clean up when popup closes
        const cleanup = () => {
          popupEl.removeEventListener("click", handler);
          m.off("popupclose", cleanup);
        };
        m.on("popupclose", cleanup);
      });
      cluster.addLayer(m);
      markersRef.current.set(l.id, m);
    });
    setVisibleCount(leads.length);
  }, [
    leads,
    focusedId,
    setFocused,
    setDetails,
    moveMutation,
    draft.coords.lat,
    draft.coords.lng,
    draft.radiusKm,
  ]);

  useEffect(() => {
    if (!focusedId) return;
    const marker = markersRef.current.get(focusedId);
    if (marker && mapRef.current && clusterRef.current) {
      const ll = marker.getLatLng();
      mapRef.current.panTo(ll, { animate: true });
      clusterRef.current.zoomToShowLayer(marker, () => marker.openPopup());
    }
  }, [focusedId]);

  const fitAll = () => {
    if (!mapRef.current || leads.length === 0) return;
    const bounds = L.latLngBounds(leads.map((l) => [l.latitude, l.longitude] as [number, number]));
    mapRef.current.fitBounds(bounds, { padding: [40, 40] });
  };

  const recenter = () => {
    if (mapRef.current && currentSearch)
      mapRef.current.setView([currentSearch.latitude, currentSearch.longitude], 13);
  };

  const legend = useMemo(
    () => [
      { label: "Quente", color: tempColor.hot },
      { label: "Morno", color: tempColor.warm },
      { label: "Frio", color: tempColor.cold },
      { label: "Ganho", color: "oklch(0.62 0.15 155)" },
      { label: "Selecionado", color: "oklch(0.62 0.16 245)" },
    ],
    [],
  );

  return (
    <div className={`relative isolate h-full w-full ${mapDark ? "map-dark" : ""}`}>
      <div
        ref={containerRef}
        className="h-full w-full"
        role="application"
        aria-label="Mapa de leads"
      />

      {(searching || !mapReady) && !mapError && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-background/60 backdrop-blur-sm">
          <div className="flex items-center gap-2 rounded-lg border bg-surface px-4 py-3 shadow-elevated text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            {searching ? "Buscando empresas..." : "Carregando o mapa..."}
          </div>
        </div>
      )}

      {mapError && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-background/80">
          <div className="max-w-xs rounded-lg border bg-surface p-4 text-center shadow-elevated">
            <p className="text-sm font-medium">Falha ao carregar o mapa</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Verifique sua conexão e tente novamente.
            </p>
            <Button
              size="sm"
              className="mt-3"
              onClick={() => {
                setMapError(false);
                mapRef.current?.invalidateSize();
              }}
            >
              Tentar novamente
            </Button>
          </div>
        </div>
      )}

      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
        <Button
          size="icon"
          variant="secondary"
          className="h-8 w-8 shadow-elevated"
          onClick={recenter}
          aria-label="Centralizar no ponto pesquisado"
        >
          <Crosshair className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          className="h-8 w-8 shadow-elevated"
          onClick={fitAll}
          aria-label="Ajustar zoom aos resultados"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant={showCircle ? "default" : "secondary"}
          className="h-8 w-8 shadow-elevated"
          onClick={() => setShowCircle((v) => !v)}
          aria-label="Alternar círculo de raio"
          aria-pressed={showCircle}
        >
          <CircleIcon className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant={mapDark ? "default" : "secondary"}
          className="h-8 w-8 shadow-elevated"
          onClick={() => setMapDark((v) => !v)}
          aria-label="Alternar tema do mapa"
          aria-pressed={mapDark}
        >
          <Moon className="h-4 w-4" />
        </Button>
      </div>
      <div className="absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-3 rounded-lg border bg-surface/95 px-3 py-2 shadow-elevated backdrop-blur">
        {legend.map((l) => (
          <div
            key={l.label}
            className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
            {l.label}
          </div>
        ))}
      </div>
      <div className="absolute top-3 left-3 z-10 rounded-lg border bg-surface/95 px-3 py-1.5 text-xs font-medium shadow-elevated backdrop-blur">
        {visibleCount}{" "}
        <span className="text-muted-foreground">de {leads.length} leads visíveis</span>
      </div>
    </div>
  );
}
