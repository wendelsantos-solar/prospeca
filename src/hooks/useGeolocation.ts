import { useCallback, useState } from "react";

export type GeoStatus = "idle" | "prompting" | "granted" | "denied" | "error";

const supported = typeof navigator !== "undefined" && "geolocation" in navigator;

export function useGeolocation(onSuccess: (coords: { lat: number; lng: number }) => void) {
  const [status, setStatus] = useState<GeoStatus>("idle");

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
  }, [onSuccess]);

  return { status, request, supported };
}
