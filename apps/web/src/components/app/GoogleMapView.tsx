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
import { MapLegend } from "./MapLegend";
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
import {
  popupHtml,
  markerVisual,
  MARKER_HEX,
  HEAT_GRADIENT_ARRAY,
  HEAT_GRADIENT_CSS,
} from "./map-popup";
import {
  buildHeatPoints,
  interpolateHeatColor,
  hexToRgba,
  findNearbyCompanies,
  heatSummaryHtml,
} from "@/lib/opportunity-heatmap";
import type { MapViewMode } from "./MapView";

// Hides Google's default POI/transit clutter (restaurants, shops, bus stops…) so
// the only markers on the map are ours. Roads, water and parks stay visible —
// those are the reference points people actually navigate by.
const CLEAN_STYLE: google.maps.MapTypeStyle[] = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ visibility: "on" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

// Minimal dark map style (Google Maps styled maps) — mirrors the OSM dark toggle.
const DARK_STYLE: google.maps.MapTypeStyle[] = [
  ...CLEAN_STYLE,
  { elementType: "geometry", stylers: [{ color: "#1f2733" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9aa7b8" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1f2733" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a3441" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#16202b" }] },
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

type HeatPoint = { lat: number; lng: number; weight: number };

/** Blob radius (px) each opportunity point contributes. Kept tight so hot spots
 * read as *localized positions*, not a broad painted "field" — smaller radius +
 * steep alpha falloff means only genuinely hot, dense areas light up. */
const HEAT_RADIUS_PX = 30;

/** Cor do círculo de raio (Fase 90): verde primário do tema, tracejado. */
const RADIUS_CIRCLE_COLOR = "oklch(0.58 0.15 152)";

/** Caminho circular aproximado (128 pontos) para a Polyline tracejada do raio. */
function radiusCirclePath(
  center: { lat: number; lng: number },
  radiusMeters: number,
): google.maps.LatLng[] {
  const pts: google.maps.LatLng[] = [];
  const N = 128;
  const latRad = (center.lat * Math.PI) / 180;
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos(latRad);
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * 2 * Math.PI;
    pts.push(
      new google.maps.LatLng(
        center.lat + (radiusMeters / metersPerDegLat) * Math.sin(a),
        center.lng + (radiusMeters / metersPerDegLng) * Math.cos(a),
      ),
    );
  }
  return pts;
}

/** Custom opportunity-density heatmap overlay. Google removed the built-in
 * HeatmapLayer in Maps JS v3.65, so we draw the heat ourselves on an
 * OverlayView (still supported). Weighted by opportunity score; additive
 * blending makes overlapping points read hotter, i.e. true density. */
interface OpportunityHeatOverlay extends google.maps.OverlayView {
  setPoints(points: HeatPoint[]): void;
  setCircle(center: { lat: number; lng: number }, radiusMeters: number): void;
}

/** Factory for the heat overlay. Deliberately a factory rather than a top-level
 * `class … extends google.maps.OverlayView`: the global `google` only exists
 * after the Maps JS loader has injected its script, so the `extends` clause
 * must be evaluated post-load. It's called from the effect that runs only once
 * the map is ready; a top-level `extends` throws "google is not defined". */
function createOpportunityHeatOverlay(
  points: HeatPoint[],
  colors: string[],
): OpportunityHeatOverlay {
  class HeatOverlay extends google.maps.OverlayView {
    private div: HTMLDivElement | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private points: HeatPoint[];
    private circle: { center: google.maps.LatLng; radiusMeters: number } | null = null;

    constructor(
      points: HeatPoint[],
      private colors: string[],
    ) {
      super();
      this.points = points;
    }

    setPoints(points: HeatPoint[]) {
      this.points = points;
      this.draw();
    }

    setCircle(center: { lat: number; lng: number }, radiusMeters: number) {
      this.circle = {
        center: new google.maps.LatLng(center.lat, center.lng),
        radiusMeters,
      };
      this.draw();
    }

    onAdd() {
      const div = document.createElement("div");
      div.style.position = "absolute";
      div.style.left = "0";
      div.style.top = "0";
      const canvas = document.createElement("canvas");
      canvas.style.position = "absolute";
      canvas.style.left = "0";
      canvas.style.top = "0";
      canvas.style.pointerEvents = "none";
      div.appendChild(canvas);
      this.div = div;
      this.canvas = canvas;
      this.getPanes()!.overlayLayer.appendChild(div);
    }

    onRemove() {
      if (this.div?.parentNode) this.div.parentNode.removeChild(this.div);
      this.div = null;
      this.canvas = null;
    }

    draw() {
      const canvas = this.canvas;
      const projection = this.getProjection();
      const map = this.getMap();
      if (!canvas || !projection || !(map instanceof google.maps.Map)) return;

      // Anchor the canvas to the *visible viewport* in the pane's own DivPixel
      // coordinate system. Google's panes are larger than the viewport and shift
      // during pan/zoom, so a canvas left fixed at (0,0) draws the heat offset
      // (the "square that sits above the radius and drifts on zoom"). Recomputing
      // the viewport bounds every draw keeps the heat glued to the map.
      const bounds = map.getBounds();
      if (!bounds) return;
      const ne = projection.fromLatLngToDivPixel(bounds.getNorthEast());
      const sw = projection.fromLatLngToDivPixel(bounds.getSouthWest());
      if (!ne || !sw) return;
      const left = Math.min(ne.x, sw.x);
      const top = Math.min(ne.y, sw.y);
      const width = Math.abs(sw.x - ne.x);
      const height = Math.abs(sw.y - ne.y);
      if (!width || !height) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.style.left = `${left}px`;
      canvas.style.top = `${top}px`;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // Clip to the search radius so heat never bleeds outside the blue circle.
      let clipped = false;
      if (this.circle && this.circle.radiusMeters > 0) {
        const c = projection.fromLatLngToDivPixel(this.circle.center);
        if (c) {
          const north = projection.fromLatLngToDivPixel(
            new google.maps.LatLng(
              this.circle.center.lat() + this.circle.radiusMeters / 111111,
              this.circle.center.lng(),
            ),
          );
          const radiusPx = north ? Math.abs(north.y - c.y) : 0;
          if (radiusPx > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(c.x - left, c.y - top, radiusPx, 0, Math.PI * 2);
            ctx.clip();
            clipped = true;
          }
        }
      }

      // Additive blending: overlapping blobs accumulate, so a region with many
      // high-score businesses genuinely reads hotter than a lone one.
      ctx.globalCompositeOperation = "lighter";
      for (const p of this.points) {
        const px = projection.fromLatLngToDivPixel(new google.maps.LatLng(p.lat, p.lng));
        if (px == null) continue;
        const x = px.x - left;
        const y = px.y - top;
        if (
          x < -HEAT_RADIUS_PX ||
          y < -HEAT_RADIUS_PX ||
          x > width + HEAT_RADIUS_PX ||
          y > height + HEAT_RADIUS_PX
        )
          continue;
        const color = interpolateHeatColor(p.weight, this.colors);
        // Steep, squared alpha: low-score points stay faint, only genuinely
        // high-opportunity points glow — so the map shows hot *spots*, not a
        // uniform field of color.
        const alpha = 0.06 + 0.94 * p.weight * p.weight;
        // Steep radial falloff keeps each blob tight (localized) instead of
        // bleeding into a wide, muddy field.
        const grad = ctx.createRadialGradient(x, y, 0, x, y, HEAT_RADIUS_PX);
        grad.addColorStop(0, hexToRgba(color, alpha));
        grad.addColorStop(0.35, hexToRgba(color, alpha * 0.55));
        grad.addColorStop(0.65, hexToRgba(color, alpha * 0.18));
        grad.addColorStop(1, hexToRgba(color, 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, HEAT_RADIUS_PX, 0, Math.PI * 2);
        ctx.fill();
      }
      if (clipped) ctx.restore();
    }
  }

  return new HeatOverlay(points, colors);
}

export function GoogleMapView({
  results,
  mode = "markers",
}: {
  results: DiscoveryResult[];
  mode?: MapViewMode;
}) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const clusterRef = useRef<MarkerClustererInstance | null>(null);
  // Fase 90: círculo de raio verde TRACEJADO — o Circle API não tem dash,
  // então é uma Polyline circular com símbolo de traço (mesma geometria).
  const circleRef = useRef<google.maps.Polyline | null>(null);
  const centerRef = useRef<google.maps.Marker | null>(null);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const heatRef = useRef<OpportunityHeatOverlay | null>(null);
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
  const heatMetric = useUIStore((s) => s.heatMetric);
  const setMapViewport = useUIStore((s) => s.setMapViewport);
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

  // Latest mode, read by the map click handler (heat zone inspect) without
  // re-subscribing the once-initialized listener to every mode change.
  const modeRef = useRef(mode);
  modeRef.current = mode;

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
          styles: useUIStore.getState().mapDark ? DARK_STYLE : CLEAN_STYLE,
        });
        mapRef.current = map;
        infoRef.current = new InfoWindow();
        clusterRef.current = new MarkerClusterer({ map, markers: [], renderer: clusterRenderer });

        // Heat zone inspect: clicking a hot blob lists the companies there and
        // why they are hot (score + signals), instead of just floating color.
        map.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (modeRef.current !== "heatmap") return;
          const latLng = e.latLng;
          if (!latLng) return;
          const nearby = findNearbyCompanies(resultsRef.current, latLng.lat(), latLng.lng());
          if (nearby.length === 0) return;
          const node = document.createElement("div");
          node.innerHTML = heatSummaryHtml(nearby);
          node.addEventListener("click", (ev) => {
            const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>("[data-place-id]");
            if (!btn) return;
            ev.preventDefault();
            actionRef.current("details", btn.dataset.placeId!);
          });
          const info = infoRef.current;
          if (info) {
            info.setContent(node);
            info.setPosition(latLng);
            info.open({ map });
          }
        });

        const setDraft = useSearchDraftStore.getState().setDraft;
        map.addListener("idle", () => {
          const c = map.getCenter();
          // Alimenta o 'Buscar nesta área' da BARRA (store transitório) —
          // o pan só ATUALIZA o estado; busca mesmo, só no clique.
          if (c) setMapViewport({ lat: c.lat(), lng: c.lng() });
          // Em heatmap não existem markers (linha 585-588 os limpa e fixa o
          // badge em results.length) — recontar markersRef aqui SEMPRE dá 0 e
          // apaga o número correto no primeiro idle. "Quantos markers estão no
          // viewport" só é a pergunta certa quando existem markers.
          if (modeRef.current !== "heatmap") {
            const bounds = map.getBounds();
            if (bounds) {
              let count = 0;
              markersRef.current.forEach((m) => {
                const pos = m.getPosition();
                if (pos && bounds.contains(pos)) count++;
              });
              setVisibleCount(count);
            }
          }
          // Only sync while picking a location (no search/preview yet) — see the
          // Leaflet view for the full rationale.
          const { currentSearch: cs, previewLocation: pl } = useLeadsStore.getState();
          if (cs || pl) return;
          const c2 = map.getCenter();
          if (c2) setDraft({ coords: { lat: c2.lat(), lng: c2.lng() } });
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
      heatRef.current?.setMap(null);
      heatRef.current = null;
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
      circleRef.current.setPath(radiusCirclePath(anchor, effectiveRadiusKm * 1000));
    } else {
      circleRef.current = new google.maps.Polyline({
        map,
        path: radiusCirclePath(anchor, effectiveRadiusKm * 1000),
        strokeOpacity: 0,
        clickable: false,
        icons: [
          {
            icon: {
              path: "M 0,-1 0,1",
              strokeColor: RADIUS_CIRCLE_COLOR,
              strokeOpacity: 0.9,
              strokeWeight: 2.5,
              scale: 6,
            },
            offset: "0",
            repeat: "26px",
          },
        ],
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
    // Heatmap mode replaces markers — the custom overlay renders instead.
    if (mode === "heatmap") {
      setVisibleCount(results.length);
      prevFocusedRef.current = null;
      return;
    }
    const markers: google.maps.Marker[] = [];
    results.forEach((r) => {
      // Sem coordenada não há onde cravar o pino (mesma regra do LeafletMapView).
      if (r.latitude == null || r.longitude == null) return;
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
        // Regra transversal: clique no marker seleciona o card E abre o detalhe.
        actionRef.current("details", r.placeId);
      });
      markers.push(m);
      markersRef.current.set(r.placeId, m);
    });
    cluster.addMarkers(markers);
    setVisibleCount(results.length);
    // Reset focused styling on results change (focus effect will re-apply).
    prevFocusedRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, mode, mapReady, openInfo]);

  // Opportunity heatmap: weighted density (score = heat) drawn on a custom
  // canvas overlay (the built-in HeatmapLayer was removed in Maps JS v3.65).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (mode !== "heatmap") {
      heatRef.current?.setMap(null);
      heatRef.current = null;
      return;
    }
    const points = buildHeatPoints(results, heatMetric);
    if (heatRef.current) {
      heatRef.current.setPoints(points);
      heatRef.current.setCircle({ lat: anchor.lat, lng: anchor.lng }, effectiveRadiusKm * 1000);
    } else {
      const overlay = createOpportunityHeatOverlay(points, HEAT_GRADIENT_ARRAY);
      heatRef.current = overlay;
      overlay.setCircle({ lat: anchor.lat, lng: anchor.lng }, effectiveRadiusKm * 1000);
      overlay.setMap(map);
    }
  }, [results, mode, mapReady, heatMetric, anchor.lat, anchor.lng, effectiveRadiusKm]);

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
    let extended = 0;
    results.forEach((r) => {
      // Só enquadra o que tem coordenada (mesma regra do LeafletMapView).
      if (r.latitude == null || r.longitude == null) return;
      bounds.extend({ lat: r.latitude, lng: r.longitude });
      extended++;
    });
    if (extended === 0) return;
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
    if (map && mapReady) map.setOptions({ styles: mapDark ? DARK_STYLE : CLEAN_STYLE });
  }, [mapDark, mapReady]);

  // Raio para a legenda compartilhada (Fase 90).
  const legendRadiusKm = currentSearch?.radiusKm ?? draft.radiusKm;

  return (
    <div className="relative isolate h-full w-full">
      <div
        ref={containerRef}
        className="h-full w-full isolate"
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
      <MapLegend mode={mode} results={results} radiusKm={legendRadiusKm} />

      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 rounded-lg border bg-surface/95 px-3 py-1.5 text-xs font-medium shadow-elevated backdrop-blur">
        {visibleCount} <span className="text-muted-foreground">de {results.length} no raio</span>
      </div>
    </div>
  );
}
