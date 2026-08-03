import { useCallback, useEffect, useState } from "react";

export type GeoStatus = "idle" | "prompting" | "granted" | "denied" | "error";

export function useGeolocation(onSuccess: (coords: { lat: number; lng: number }) => void) {
  const [status, setStatus] = useState<GeoStatus>("idle");
  // The server and the client's first render must agree. Browser capability is
  // detected after hydration; computing it at module load caused React to
  // discard the SSR tree whenever the GPS button appeared only on the client.
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported("geolocation" in navigator);
  }, []);

  const request = useCallback(() => {
    if (!supported) {
      setStatus("error");
      return;
    }
    setStatus("prompting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStatus("granted");
        onSuccess({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "error");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }, [onSuccess, supported]);

  return { status, request, supported };
}
