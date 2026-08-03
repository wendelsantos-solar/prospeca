/// <reference types="google.maps" />
import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import type {
  MarkerClusterer as MarkerClustererInstance,
  Renderer,
} from "@googlemaps/markerclusterer";
import type { DiscoveryResult } from "@/repositories/types";
import { useLeadsStore, useSearchDraftStore, useUIStore } from "@/stores";
import { useSearchSession } from "@/stores/searchSession";
import { RadarPill } from "./RadarPill";
import { useAddToFunnelMutation, discoveryKeys } from "@/hooks/useLeadsQuery";
import { useOutbound } from "@/hooks/useOutbound";
import { useQueryClient } from "@tanstack/react-query";
import { getSearchRepository } from "@/repositories";
import { Button } from "@/components/ui/button";
import {
  Crosshair,
  ZoomIn,
  Circle as CircleIcon,
  Moon,
  Loader2,
  RefreshCw,
  Info,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { env } from "@/lib/env";
import { toast } from "sonner";
import { popupHtml, markerVisual, MARKER_HEX } from "./map-popup";

// Minimal dark map style (Google Maps styled maps) — mirrors the OSM dark toggle.
const DARK_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1f2733" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9aa7b8" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1f2733" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a3441" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#16202b" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
];

// setOptions must run exactly once per page load (the loader warns and ignores
// repeats) — StrictMode remounts the component twice in dev, hence the guard.
let loaderConfigured = false;
function configureLoader(key: string) {
  if (loaderConfigured) return;
  loaderConfigured = true;
  setOptions({ key });
}

function svgIcon(color: string, ring: string, text: string, size: number): string {
  const r = size / 2;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
    `<circle cx="${r}" cy="${r}" r="${r - 2}" fill="${color}" stroke="${ring}" stroke-width="2"/>` +
    `<text x="${r}" y="${r + 4}" font-size="11" font-weight="600" fill="#fff" text-anchor="middle" font-family="sans-serif">${text}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function GoogleMapView({ results }: { results: DiscoveryResult[] }) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const clusterRef = useRef<MarkerClustererInstance | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const centerRef = useRef<google.maps.Marker | null>(null);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
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
  const { openWhatsApp } = useOutbound();
  const showCircle = useUIStore((s) => s.mapShowCircle);
  const setShowCircle = useUIStore((s) => s.setMapShowCircle);
  const mapDark = useUIStore((s) => s.mapDark);
  const setMapDark = useUIStore((s) => s.setMapDark);
  const mapLegendCollapsed = useUIStore((s) => s.mapLegendCollapsed);
  const setMapLegendCollapsed = useUIStore((s) => s.setMapLegendCollapsed);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [visibleCount, setVisibleCount] = useState(results.length);

  // Latest popup-action handler kept in a ref so the marker effect always calls
  // the current closure (results change) without rebinding listeners.
  const actionRef = useRef<(action: string, placeId: string) => void>(() => {});
  actionRef.current = (action, placeId) => {
    const searchId = currentSearch?.id;
    const result = results.find((x) => x.placeId === placeId);
    if (!result || !searchId) return;
    if (action === "whatsapp") {
      // Contatar = entra no funil como 'contacted'.
      void openWhatsApp(result, {
        materialize: result.importedLeadId == null ? { searchId, placeId } : undefined,
      });
    }
    if (action === "funnel") {
      addToFunnel.mutate(
        { searchId, placeId, stage: "new" },
        { onSuccess: () => toast.success("Adicionado ao funil") },
      );
    }
    if (action === "details") {
      if (result.importedLeadId != null) {
        setDetails(result.importedLeadId);
      } else {
        setPreview(result);
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

  // Latest results, read by the focus effect without re-subscribing to them.
  const resultsRef = useRef(results);
  resultsRef.current = results;

  // Build the info-window content + wire its action buttons, then open it on the
  // given marker. Shared by the marker click and the list→map focus effect so a
  // card click and a marker click open the exact same popup.
  const openInfo = useCallback((marker: google.maps.Marker, r: DiscoveryResult) => {
    const info = infoRef.current;
    const map = mapRef.current;
    if (!info || !map) return;
    const node = document.createElement("div");
    node.innerHTML = popupHtml(r);
    node.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-action][data-id]");
      if (!btn) return;
      e.preventDefault();
      actionRef.current(btn.dataset.action!, btn.dataset.id!);
    });
    info.setContent(node);
    info.open({ map, anchor: marker });
  }, []);

  // ── Init map (once) ──
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const key = env.googleMapsBrowserKey;
    if (!key) {
      setMapError(true);
      return;
    }
    let cancelled = false;
    configureLoader(key);
    Promise.all([importLibrary("maps"), import("@googlemaps/markerclusterer")])
      .then(async ([{ Map, InfoWindow }, { MarkerClusterer }]) => {
        await importLibrary("marker");
        if (cancelled || !containerRef.current) return;
        const map = new Map(containerRef.current, {
          center: {
            lat: currentSearch?.latitude ?? -30.0346,
            lng: currentSearch?.longitude ?? -51.2177,
          },
          zoom: 13,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          styles: useUIStore.getState().mapDark ? DARK_STYLE : undefined,
        });
        mapRef.current = map;
        infoRef.current = new InfoWindow();
        clusterRef.current = new MarkerClusterer({ map, markers: [], renderer: clusterRenderer });

        const setDraft = useSearchDraftStore.getState().setDraft;
        map.addListener("idle", () => {
          const bounds = map.getBounds();
          if (bounds) {
            let count = 0;
            markersRef.current.forEach((m) => {
              const pos = m.getPosition();
              if (pos && bounds.contains(pos)) count++;
            });
            setVisibleCount(count);
          }
          // Only sync while picking a location (no search/preview yet) — see the
          // Leaflet view for the full rationale.
          const { currentSearch: cs, previewLocation: pl } = useLeadsStore.getState();
          if (cs || pl) return;
          const c = map.getCenter();
          if (c) setDraft({ coords: { lat: c.lat(), lng: c.lng() } });
        });
        setMapReady(true);
        setMapError(false);
      })
      .catch(() => {
        if (!cancelled) setMapError(true);
      });
    return () => {
      cancelled = true;
      if (mapRef.current) google.maps.event.clearInstanceListeners(mapRef.current);
      clusterRef.current?.clearMarkers();
      clusterRef.current = null;
      circleRef.current?.setMap(null);
      circleRef.current = null;
      centerRef.current?.setMap(null);
      centerRef.current = null;
      infoRef.current?.close();
      infoRef.current = null;
      mapRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clusterRenderer: Renderer = useMemo(
    () => ({
      render: ({ count, position }) =>
        new google.maps.Marker({
          position,
          icon: {
            url: svgIcon(MARKER_HEX.funnel, "#fff", String(count), 34),
            scaledSize: new google.maps.Size(34, 34),
            anchor: new google.maps.Point(17, 17),
          },
          zIndex: 1000 + count,
        }),
    }),
    [],
  );

  const anchor = currentSearch
    ? { lat: currentSearch.latitude, lng: currentSearch.longitude }
    : previewLocation
      ? { lat: previewLocation.lat, lng: previewLocation.lng }
      : { lat: draft.coords.lat, lng: draft.coords.lng };

  // Raio segue o SLIDER ao vivo (draft) — o círculo cresce/encolhe enquanto você
  // arrasta. (O centro/anchor fica pinado no currentSearch; só o raio é live.)
  const effectiveRadiusKm = draft.radiusKm;

  // Enquadra SÓ ao trocar de centro (busca/local nova). Mudar o raio NÃO
  // re-enquadra → o círculo cresce/encolhe à vista no zoom atual. (O botão de
  // ajuste reenquadra se ficar grande demais.)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const circle = new google.maps.Circle({ center: anchor, radius: effectiveRadiusKm * 1000 });
    const cb = circle.getBounds();
    if (cb) map.fitBounds(cb, 48);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fit só no centro; raio faz resize in-place
  }, [anchor.lat, anchor.lng, mapReady]);

  // Radius circle + center dot, pinned to anchor.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (!showCircle) {
      circleRef.current?.setMap(null);
      circleRef.current = null;
    } else if (circleRef.current) {
      circleRef.current.setCenter(anchor);
      circleRef.current.setRadius(effectiveRadiusKm * 1000);
    } else {
      circleRef.current = new google.maps.Circle({
        map,
        center: anchor,
        radius: effectiveRadiusKm * 1000,
        strokeColor: "#2563eb",
        strokeOpacity: 0.95,
        strokeWeight: 3,
        fillColor: "#2563eb",
        fillOpacity: 0.08,
        clickable: false,
      });
    }
    centerRef.current?.setMap(null);
    centerRef.current = new google.maps.Marker({
      map,
      position: anchor,
      clickable: false,
      icon: {
        url: svgIcon(MARKER_HEX.funnel, "#fff", "", 12),
        scaledSize: new google.maps.Size(12, 12),
        anchor: new google.maps.Point(6, 6),
      },
      zIndex: 1,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    anchor.lat,
    anchor.lng,
    currentSearch?.radiusKm,
    previewLocation?.radiusKm,
    draft.radiusKm,
    showCircle,
    mapReady,
  ]);

  // Previous focusedId ref for delta updates (avoids full marker rebuild on focus change).
  const prevFocusedRef = useRef<string | null>(null);

  // Rebuild markers only when results change (not on focus change).
  useEffect(() => {
    const map = mapRef.current;
    const cluster = clusterRef.current;
    if (!map || !cluster || !mapReady) return;
    cluster.clearMarkers();
    markersRef.current.clear();
    const markers: google.maps.Marker[] = [];
    results.forEach((r) => {
      const visual = markerVisual(r, false); // never selected on build — focus effect handles it
      const m = new google.maps.Marker({
        position: { lat: r.latitude, lng: r.longitude },
        icon: {
          url: svgIcon(visual.color, visual.ring, String(r.score), visual.size),
          scaledSize: new google.maps.Size(visual.size, visual.size),
          anchor: new google.maps.Point(visual.size / 2, visual.size / 2),
        },
        zIndex: visual.zIndex,
      });
      m.addListener("click", () => {
        setFocused(r.placeId);
        window.dispatchEvent(new CustomEvent("lead-focused-from-map", { detail: r.placeId }));
        openInfo(m, r);
      });
      markers.push(m);
      markersRef.current.set(r.placeId, m);
    });
    cluster.addMarkers(markers);
    setVisibleCount(results.length);
    // Reset focused styling on results change (focus effect will re-apply).
    prevFocusedRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, mapReady, openInfo]);

  // Delta update: just toggle the focused/unfocused marker icons without rebuilding all.
  useEffect(() => {
    if (!mapReady) return;
    const prev = prevFocusedRef.current;
    const next = focusedId;
    // Update previously focused marker back to normal
    if (prev && prev !== next) {
      const oldMarker = markersRef.current.get(prev);
      const oldResult = resultsRef.current.find((r) => r.placeId === prev);
      if (oldMarker && oldResult) {
        const visual = markerVisual(oldResult, false);
        oldMarker.setIcon({
          url: svgIcon(visual.color, visual.ring, String(oldResult.score), visual.size),
          scaledSize: new google.maps.Size(visual.size, visual.size),
          anchor: new google.maps.Point(visual.size / 2, visual.size / 2),
        });
        oldMarker.setZIndex(visual.zIndex);
      }
    }
    // Update newly focused marker
    if (next && next !== prev) {
      const newMarker = markersRef.current.get(next);
      const newResult = resultsRef.current.find((r) => r.placeId === next);
      if (newMarker && newResult) {
        const visual = markerVisual(newResult, true);
        newMarker.setIcon({
          url: svgIcon(visual.color, visual.ring, String(newResult.score), visual.size),
          scaledSize: new google.maps.Size(visual.size, visual.size),
          anchor: new google.maps.Point(visual.size / 2, visual.size / 2),
        });
        newMarker.setZIndex(visual.zIndex);
      }
    }
    prevFocusedRef.current = next;
  }, [focusedId, mapReady]);

  // Focus (from a card click or a marker click): pan to the marker and open its
  // popup, so selecting a card in the list surfaces the same balloon on the map.
  useEffect(() => {
    if (!focusedId || !mapReady) return;
    const map = mapRef.current;
    const marker = markersRef.current.get(focusedId);
    const r = resultsRef.current.find((x) => x.placeId === focusedId);
    if (map && marker) {
      const pos = marker.getPosition();
      if (pos) map.panTo(pos);
      if (r) openInfo(marker, r);
    }
  }, [focusedId, mapReady, openInfo]);

  const fitAll = () => {
    const map = mapRef.current;
    if (!map || results.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    results.forEach((r) => bounds.extend({ lat: r.latitude, lng: r.longitude }));
    map.fitBounds(bounds, 40);
  };

  const recenter = () => {
    const map = mapRef.current;
    if (map && currentSearch) {
      map.setCenter({ lat: currentSearch.latitude, lng: currentSearch.longitude });
      map.setZoom(13);
    }
  };

  // React to the dark toggle after init.
  useEffect(() => {
    const map = mapRef.current;
    if (map && mapReady) map.setOptions({ styles: mapDark ? DARK_STYLE : undefined });
  }, [mapDark, mapReady]);

  const legend = useMemo(
    () => [
      { label: "Quente", color: MARKER_HEX.hot },
      { label: "Morno", color: MARKER_HEX.warm },
      { label: "Frio", color: MARKER_HEX.cold },
      { label: "No funil", color: MARKER_HEX.funnel },
      { label: "Selecionado", color: MARKER_HEX.selected },
    ],
    [],
  );

  return (
    <div className="relative isolate h-full w-full">
      <div
        ref={containerRef}
        className="h-full w-full isolate"
        role="application"
        aria-label="Mapa de leads"
      />

      <RadarPill onSearch={() => useSearchSession.getState().radarSearch()} />

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
              Habilite a <b>Maps JavaScript API</b> na chave (Google Cloud) e confirme a restrição
              por domínio.
            </p>
            <Button size="sm" className="mt-3" onClick={() => setMapError(false)}>
              Tentar novamente
            </Button>
          </div>
        </div>
      )}

      <div className="absolute top-3 right-3 z-10 flex flex-col gap-0.5 rounded-lg border border-border bg-surface/95 p-1 shadow-elevated backdrop-blur">
        {results.length > 0 && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => {
              useSearchSession.getState().refreshSearch();
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
          variant="ghost"
          className="h-8 w-8"
          onClick={recenter}
          aria-label="Centralizar no ponto pesquisado"
        >
          <Crosshair className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={fitAll}
          aria-label="Ajustar zoom aos resultados"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <div className="my-0.5 h-px bg-border" />
        <Button
          size="icon"
          variant={showCircle ? "default" : "ghost"}
          className="h-8 w-8"
          onClick={() => setShowCircle(!showCircle)}
          aria-label="Alternar círculo de raio"
          aria-pressed={showCircle}
        >
          <CircleIcon className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant={mapDark ? "default" : "ghost"}
          className="h-8 w-8"
          onClick={() => setMapDark(!mapDark)}
          aria-label="Alternar tema do mapa"
          aria-pressed={mapDark}
        >
          <Moon className="h-4 w-4" />
        </Button>
      </div>
      <div className="absolute bottom-3 left-3 z-10 rounded-lg border border-border bg-surface/95 shadow-elevated backdrop-blur">
        <button
          type="button"
          onClick={() => setMapLegendCollapsed(!mapLegendCollapsed)}
          aria-expanded={!mapLegendCollapsed}
          aria-label={mapLegendCollapsed ? "Expandir legenda" : "Recolher legenda"}
          className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          <Info className="h-3.5 w-3.5" />
          Legenda
          {mapLegendCollapsed ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
        {!mapLegendCollapsed && (
          <div className="flex flex-wrap items-center gap-3 border-t border-border px-3 py-2">
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
        )}
      </div>
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 rounded-lg border bg-surface/95 px-3 py-1.5 text-xs font-medium shadow-elevated backdrop-blur">
        {visibleCount} <span className="text-muted-foreground">de {results.length} no raio</span>
      </div>
    </div>
  );
}
