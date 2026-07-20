// Google Maps JS API implementation of MapProvider.
// SDK loads lazily via dynamic script injection; browser key only.
import { env } from "@/lib/env";
import type { Coordinates, MapBounds, MapMarker, MapProvider } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any;
    __gmapsLoaded?: Promise<void>;
  }
}

function loadGoogleMapsSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.google?.maps) return Promise.resolve();
  if (window.__gmapsLoaded) return window.__gmapsLoaded;

  const key = env.googleMapsBrowserKey;
  if (!key) {
    return Promise.reject(
      new Error("Google Maps não configurado (VITE_GOOGLE_MAPS_BROWSER_KEY ausente)."),
    );
  }

  window.__gmapsLoaded = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=marker&loading=async&callback=__onGmapsReady`;
    script.async = true;
    (window as any).__onGmapsReady = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar o Google Maps SDK."));
    document.head.appendChild(script);
  });
  return window.__gmapsLoaded;
}

export class GoogleMapProvider implements MapProvider {
  private map: any = null;
  private markers = new Map<string, any>();
  private circle: any = null;
  private markerClickHandler: ((id: string) => void) | null = null;
  private boundsHandler: ((bounds: MapBounds) => void) | null = null;
  private boundsDebounce: ReturnType<typeof setTimeout> | null = null;
  private selectedId: string | null = null;

  async initialize(container: HTMLElement): Promise<void> {
    await loadGoogleMapsSdk();
    const { Map } = await window.google.maps.importLibrary("maps");
    this.map = new Map(container, {
      center: { lat: -23.5505, lng: -46.6333 },
      zoom: 12,
      mapId: "radar-local",
      disableDefaultUI: false,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
    });

    this.map.addListener("idle", () => {
      if (!this.boundsHandler) return;
      if (this.boundsDebounce) clearTimeout(this.boundsDebounce);
      this.boundsDebounce = setTimeout(() => {
        const b = this.map.getBounds();
        if (!b) return;
        const ne = b.getNorthEast();
        const sw = b.getSouthWest();
        this.boundsHandler?.({
          north: ne.lat(),
          south: sw.lat(),
          east: ne.lng(),
          west: sw.lng(),
        });
      }, 400);
    });
  }

  setCenter(position: Coordinates): void {
    this.map?.setCenter({ lat: position.latitude, lng: position.longitude });
  }

  setRadius(center: Coordinates, radiusMeters: number): void {
    if (!this.map) return;
    if (this.circle) this.circle.setMap(null);
    this.circle = new window.google.maps.Circle({
      map: this.map,
      center: { lat: center.latitude, lng: center.longitude },
      radius: radiusMeters,
      strokeColor: "#6366f1",
      strokeOpacity: 0.6,
      strokeWeight: 1.5,
      fillColor: "#6366f1",
      fillOpacity: 0.08,
      clickable: false,
    });
  }

  setMarkers(markers: MapMarker[]): void {
    if (!this.map) return;
    for (const existing of this.markers.values()) existing.setMap(null);
    this.markers.clear();

    for (const m of markers) {
      const marker = new window.google.maps.Marker({
        map: this.map,
        position: { lat: m.position.latitude, lng: m.position.longitude },
        title: m.label,
        opacity: this.selectedId && this.selectedId !== m.id ? 0.6 : 1,
      });
      marker.addListener("click", () => this.markerClickHandler?.(m.id));
      this.markers.set(m.id, marker);
    }
  }

  fitBounds(markers: MapMarker[]): void {
    if (!this.map || markers.length === 0) return;
    const bounds = new window.google.maps.LatLngBounds();
    for (const m of markers) {
      bounds.extend({ lat: m.position.latitude, lng: m.position.longitude });
    }
    this.map.fitBounds(bounds, 48);
  }

  selectMarker(id: string): void {
    this.selectedId = id;
    for (const [markerId, marker] of this.markers) {
      marker.setOpacity(markerId === id ? 1 : 0.6);
      if (markerId === id) {
        marker.setAnimation(window.google.maps.Animation.BOUNCE);
        setTimeout(() => marker.setAnimation(null), 700);
      }
    }
  }

  onMarkerClick(handler: (id: string) => void): void {
    this.markerClickHandler = handler;
  }

  onBoundsChanged(handler: (bounds: MapBounds) => void): void {
    this.boundsHandler = handler;
  }

  destroy(): void {
    if (this.boundsDebounce) clearTimeout(this.boundsDebounce);
    for (const marker of this.markers.values()) marker.setMap(null);
    this.markers.clear();
    this.circle?.setMap(null);
    this.map = null;
  }
}
