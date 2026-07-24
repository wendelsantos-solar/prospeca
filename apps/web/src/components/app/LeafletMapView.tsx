import { useEffect, useRef, useMemo, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import type { DiscoveryResult } from "@/repositories/types";
import { useLeadsStore, useSearchDraftStore, useUIStore } from "@/stores";
import { RadarPill } from "./RadarPill";
import { useAddToFunnelMutation, discoveryKeys, useSuppressionHashes } from "@/hooks/useLeadsQuery";
import { isContactSuppressed } from "@/lib/suppression";
import { useQueryClient } from "@tanstack/react-query";
import { getSearchRepository } from "@/repositories";
import { Button } from "@/components/ui/button";
import { Crosshair, ZoomIn, Circle as CircleIcon, Moon, Loader2, RefreshCw } from "lucide-react";
import { env } from "@/lib/env";
import { toast } from "sonner";
import { popupHtml } from "./map-popup";

const tempColor: Record<DiscoveryResult["temperature"], string> = {
  hot: "oklch(0.72 0.17 55)",
  warm: "oklch(0.83 0.15 90)",
  cold: "oklch(0.72 0.04 250)",
};

function markerIcon(r: DiscoveryResult, selected: boolean) {
  const inFunnel = r.importedLeadId != null;
  const color = selected
    ? "oklch(0.62 0.16 245)"
    : inFunnel
      ? "oklch(0.62 0.15 155)"
      : tempColor[r.temperature];
  const ring = inFunnel ? "border:2px solid oklch(0.55 0.18 150);" : "border:2px solid white;";
  const html = `<div style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:${color};color:#fff;font-size:11px;font-weight:600;box-shadow:0 2px 6px rgba(0,0,0,0.25);${ring}">${r.score}</div>`;
  return L.divIcon({ html, className: "lead-marker", iconSize: [26, 26], iconAnchor: [13, 13] });
}

/** OSM/Leaflet renderer (free, no key). Lazy-loaded by MapView only when there
 * is no Google Maps browser key, so Leaflet never ships when Google is used. */
export function LeafletMapView({ results }: { results: DiscoveryResult[] }) {
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
  const setPreview = useLeadsStore((s) => s.setPreview);
  const searching = useLeadsStore((s) => s.searching);
  const addToFunnel = useAddToFunnelMutation();
  const queryClient = useQueryClient();
  const { data: suppressed } = useSuppressionHashes();
  // Persisted so a marked circle / dark map survives a page refresh.
  const showCircle = useUIStore((s) => s.mapShowCircle);
  const setShowCircle = useUIStore((s) => s.setMapShowCircle);
  const mapDark = useUIStore((s) => s.mapDark);
  const setMapDark = useUIStore((s) => s.setMapDark);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [visibleCount, setVisibleCount] = useState(results.length);

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
        // Our marker-rebuild effect calls clearLayers()+re-adds on every leads/focus
        // change, which can race with markercluster's own zoom/spiderfy animation
        // queue and throw ("Cannot use 'in' operator... in undefined" inside
        // _animationEnd/showMarker). Disabling the animation removes that async
        // queue entirely.
        animate: false,
        animateAddingMarkers: false,
        iconCreateFunction: (c) =>
          L.divIcon({
            html: `<div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:oklch(0.58 0.14 155);color:#fff;font-size:12px;font-weight:700;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);">${c.getChildCount()}</div>`,
            className: "lead-cluster",
            iconSize: [34, 34],
          }),
      });
      map.addLayer(cluster);
      clusterRef.current = cluster;
      const setDraft = useSearchDraftStore.getState().setDraft;
      const updateVisible = () => {
        const bounds = map.getBounds();
        let count = 0;
        markersRef.current.forEach((m) => {
          if (bounds.contains(m.getLatLng())) count++;
        });
        setVisibleCount(count);
      };
      const syncCenterToDraft = () => {
        // Only sync while the user is still panning around to PICK a location,
        // before any search/preview exists. Once a location is set (typed,
        // searched, or previewed), panning to look at results must never
        // silently retarget where the next search runs — the address field
        // wouldn't reflect it, so a later "Atualizar busca" would search
        // wherever the map was last dragged to, not where the field says.
        const { currentSearch, previewLocation } = useLeadsStore.getState();
        if (currentSearch || previewLocation) return;
        const c = map.getCenter();
        setDraft({ coords: { lat: c.lat, lng: c.lng } });
      };
      map.on("moveend zoomend", updateVisible);
      map.on("moveend", syncCenterToDraft);
      mapRef.current = map;
      return () => {
        map.remove();
        mapRef.current = null;
        clusterRef.current = null;
        // Must null these too: on a StrictMode remount (dev) the refs survive but
        // point to a circle/marker on the now-destroyed map. Without clearing,
        // the circle effect sees circleRef set and only *updates* the orphan on
        // the dead map instead of creating a fresh one on the new map — so the
        // circle never renders until the user toggles it off and back on.
        circleRef.current = null;
        centerRef.current = null;
      };
    } catch {
      setMapError(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Anchor for the circle/marker: the committed search center (fixed — panning
  // or zooming the map must NEVER move it, like Tinder's "X km around me")
  // takes priority, then a chosen-but-not-searched-yet preview location, then
  // (only pre-first-search) the live map center as the user looks around.
  const anchor = currentSearch
    ? { lat: currentSearch.latitude, lng: currentSearch.longitude }
    : previewLocation
      ? { lat: previewLocation.lat, lng: previewLocation.lng }
      : { lat: draft.coords.lat, lng: draft.coords.lng };

  // Effective radius: committed search wins, then preview, then the live slider.
  const effectiveRadiusKm = currentSearch?.radiusKm ?? previewLocation?.radiusKm ?? draft.radiusKm;

  // Enquadra SÓ ao trocar de centro (busca/local nova). Mudar o raio NÃO
  // re-enquadra → o círculo cresce/encolhe à vista no zoom atual.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.fitBounds(L.latLng(anchor.lat, anchor.lng).toBounds(effectiveRadiusKm * 1000 * 2.4));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fit só no centro; raio faz resize in-place
  }, [anchor.lat, anchor.lng]);

  // Circle + center marker: position is pinned to `anchor` (fixed once a search
  // or preview exists); only the radius reacts live to the slider so shrinking
  // it previews/filters instantly without ever dragging the circle off-center.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const radiusKm = effectiveRadiusKm;
    // Plain hex (not oklch): Leaflet paints circles as SVG paths and sets stroke/
    // fill as presentation attributes, where a hex value is guaranteed to render.
    const circleStyle: L.PathOptions = {
      color: "#2563eb",
      fillColor: "#2563eb",
      fillOpacity: 0.08,
      weight: 3,
      opacity: 0.95,
    };
    if (!showCircle) {
      if (circleRef.current) {
        map.removeLayer(circleRef.current);
        circleRef.current = null;
      }
    } else if (circleRef.current) {
      circleRef.current.setLatLng(anchor);
      circleRef.current.setRadius(radiusKm * 1000);
    } else {
      circleRef.current = L.circle(anchor, { radius: radiusKm * 1000, ...circleStyle }).addTo(map);
    }
    if (centerRef.current) map.removeLayer(centerRef.current);
    centerRef.current = L.marker(anchor, {
      icon: L.divIcon({
        html: '<div style="width:12px;height:12px;border-radius:50%;background:oklch(0.58 0.14 155);border:2px solid white;box-shadow:0 0 0 3px oklch(0.58 0.14 155 / 0.25);"></div>',
        className: "",
        iconSize: [12, 12],
      }),
    }).addTo(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- anchor is a derived object recomputed every render; tracked via its lat/lng primitives instead
  }, [
    anchor.lat,
    anchor.lng,
    currentSearch?.radiusKm,
    previewLocation?.radiusKm,
    draft.radiusKm,
    showCircle,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    const cluster = clusterRef.current;
    if (!map || !cluster) return;
    cluster.clearLayers();
    markersRef.current.clear();
    const searchId = currentSearch?.id;
    results.forEach((r) => {
      const m = L.marker([r.latitude, r.longitude], {
        icon: markerIcon(r, r.placeId === focusedId),
      }).on("click", () => {
        setFocused(r.placeId);
        // Lets AppSidebar scroll the matching card into view — the list has no
        // other way to know a focus change originated from a map click vs. a
        // click on the card itself (which is already in view).
        window.dispatchEvent(new CustomEvent("lead-focused-from-map", { detail: r.placeId }));
      });
      m.bindPopup(popupHtml(r));
      m.on("popupopen", () => {
        // Use event delegation on the popup container — more reliable than
        // setTimeout + querySelectorAll which races with Leaflet's DOM updates.
        const popupEl = m.getPopup()?.getElement();
        if (!popupEl) return;
        const handler = async (e: Event) => {
          const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(
            "[data-action][data-id]",
          );
          if (!btn) return;
          e.preventDefault();
          const placeId = btn.dataset.id!;
          const action = btn.dataset.action;
          const result = results.find((x) => x.placeId === placeId);
          if (!result || !searchId) return;
          if (action === "whatsapp") {
            const num = (result.phone ?? "").replace(/\D/g, "");
            if (!num) return toast.error("Sem telefone");
            if (suppressed && (await isContactSuppressed(suppressed, result))) {
              return toast.error("Contato em opt-out — não contatar (LGPD).");
            }
            // Contatar = entra no funil como 'contacted'.
            if (result.importedLeadId == null) {
              addToFunnel.mutate({ searchId, placeId, stage: "contacted" });
            }
            window.open(`https://wa.me/${num}`, "_blank");
          }
          if (action === "funnel") {
            addToFunnel.mutate(
              { searchId, placeId, stage: "new" },
              { onSuccess: () => toast.success("Adicionado ao funil") },
            );
          }
          if (action === "details") {
            // In funnel → full lead drawer; otherwise read-only discovery preview.
            if (result.importedLeadId != null) {
              setDetails(result.importedLeadId);
            } else {
              setPreview(result);
              // Lazy enrich a with-site business lacking contact yet.
              if (result.hasWebsite && !result.email && !result.instagram && !result.whatsapp) {
                getSearchRepository()
                  .enrichDiscovery(searchId, result.placeId)
                  .then(() =>
                    queryClient.invalidateQueries({ queryKey: discoveryKeys.bySearch(searchId) }),
                  )
                  .catch(() => {});
              }
            }
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
      markersRef.current.set(r.placeId, m);
    });
    setVisibleCount(results.length);
  }, [
    results,
    focusedId,
    setFocused,
    setDetails,
    setPreview,
    addToFunnel,
    queryClient,
    suppressed,
    currentSearch?.id,
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
    if (!mapRef.current || results.length === 0) return;
    const bounds = L.latLngBounds(
      results.map((r) => [r.latitude, r.longitude] as [number, number]),
    );
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
      { label: "No funil", color: "oklch(0.62 0.15 155)" },
      { label: "Selecionado", color: "oklch(0.62 0.16 245)" },
    ],
    [],
  );

  return (
    <div className={`relative isolate h-full w-full ${mapDark ? "map-dark" : ""}`}>
      <div
        ref={containerRef}
        className="h-full w-full isolate"
        role="application"
        aria-label="Mapa de leads"
      />

      <RadarPill onSearch={() => window.dispatchEvent(new CustomEvent("radar-search"))} />

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
        {results.length > 0 && (
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8 shadow-elevated"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("refresh-search"));
              toast.info("Atualizando resultados direto do Google…");
            }}
            aria-label="Atualizar resultados (busca nova no Google)"
            title="Atualizar (paga Google)"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
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
          onClick={() => setShowCircle(!showCircle)}
          aria-label="Alternar círculo de raio"
          aria-pressed={showCircle}
        >
          <CircleIcon className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant={mapDark ? "default" : "secondary"}
          className="h-8 w-8 shadow-elevated"
          onClick={() => setMapDark(!mapDark)}
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
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 rounded-lg border bg-surface/95 px-3 py-1.5 text-xs font-medium shadow-elevated backdrop-blur">
        {visibleCount} <span className="text-muted-foreground">de {results.length} no raio</span>
      </div>
    </div>
  );
}
