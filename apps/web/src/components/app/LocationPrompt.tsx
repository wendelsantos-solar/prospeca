import { useEffect } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useLeadsStore, useLocationStore, useSettingsStore } from "@/stores";
import { useSearchSession } from "@/stores/searchSession";
import { reverseGeocodeCoords } from "@/lib/reverse-geocode";
import { toast } from "sonner";

interface LocationPromptProps {
  onDismiss: () => void;
  onPickCity: () => void;
}

export function LocationPrompt({ onDismiss, onPickCity }: LocationPromptProps) {
  const setPreviewLocation = useLeadsStore((s) => s.setPreviewLocation);
  const setLastLocation = useLocationStore((s) => s.setLastLocation);
  const defaultRadius = useSettingsStore((s) => s.defaultRadius);

  const { status, request, supported } = useGeolocation((coords) => {
    setPreviewLocation({
      lat: coords.lat,
      lng: coords.lng,
      radiusKm: defaultRadius,
      label: "Localizando...",
    });
    onDismiss();
    // Label assíncrono — não bloqueia o pin.
    reverseGeocodeCoords(coords.lat, coords.lng).then((resolved) => {
      const finalLabel = resolved ?? "Minha localização";
      setPreviewLocation({
        lat: coords.lat,
        lng: coords.lng,
        radiusKm: defaultRadius,
        label: finalLabel,
      });
      setLastLocation({ label: finalLabel, lat: coords.lat, lng: coords.lng });
      useSearchSession.getState().geoLocated(finalLabel, coords.lat, coords.lng);
    });
  });

  useEffect(() => {
    if (status === "denied" || status === "error") {
      toast.error("Sem acesso à localização — escolha uma cidade.");
    }
  }, [status]);

  return (
    <div className="pointer-events-none absolute inset-0 z-[500] grid place-items-center p-4">
      <div className="pointer-events-auto w-full max-w-sm rounded-xl border bg-surface/95 p-5 text-center shadow-elevated backdrop-blur">
        <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
          <MapPin className="h-5 w-5" />
        </div>
        <h2 className="text-base font-semibold">Ver empresas perto de você?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Usamos sua localização apenas para centralizar o mapa e sugerir oportunidades próximas.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {supported && (
            <Button onClick={request} disabled={status === "prompting"} className="gap-2">
              {status === "prompting" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MapPin className="h-4 w-4" />
              )}
              Usar minha localização
            </Button>
          )}
          <Button variant="outline" onClick={onPickCity}>
            Escolher cidade
          </Button>
        </div>
      </div>
    </div>
  );
}
