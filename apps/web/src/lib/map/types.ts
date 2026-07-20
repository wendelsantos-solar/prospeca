export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface MapMarker {
  id: string;
  position: Coordinates;
  label?: string;
  score?: number;
  selected?: boolean;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/**
 * Provider-agnostic map contract. Current implementation:
 * GoogleMapProvider (required for Google Places data). The Leaflet map
 * remains only for demo mode with fictitious data — Google Places
 * results must never be rendered over OpenStreetMap tiles.
 */
export interface MapProvider {
  initialize(container: HTMLElement): Promise<void>;
  setCenter(position: Coordinates): void;
  setRadius(center: Coordinates, radiusMeters: number): void;
  setMarkers(markers: MapMarker[]): void;
  fitBounds(markers: MapMarker[]): void;
  selectMarker(id: string): void;
  onMarkerClick(handler: (id: string) => void): void;
  onBoundsChanged(handler: (bounds: MapBounds) => void): void;
  destroy(): void;
}
