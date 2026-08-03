import { useMemo, useState } from "react";
import { useLeadsStore } from "@/stores";
import { useLeadsList, useDiscoveryResults } from "@/hooks/useLeadsQuery";
import {
  optimizeVisitOrder,
  buildGoogleMapsRouteUrl,
  buildWazeNavigationUrl,
  type OrderedStop,
} from "@/lib/route";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MapPinned, Navigation, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface RouteTarget {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export function RouteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const selected = useLeadsStore((s) => s.selectedIds);
  const currentSearch = useLeadsStore((s) => s.currentSearch);
  const { data: leadPage } = useLeadsList({ quick: [] });
  const { data: discovery } = useDiscoveryResults(currentSearch?.id);
  const [locating, setLocating] = useState(false);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);

  const targets = useMemo<RouteTarget[]>(() => {
    const byPlace = new Map((discovery ?? []).map((r) => [r.placeId, r]));
    const byLead = new Map((leadPage?.items ?? []).map((l) => [l.id, l]));
    return selected
      .map((id): RouteTarget | null => {
        const r = byPlace.get(id);
        if (r)
          return {
            id: r.placeId,
            name: r.name,
            address: r.address ?? "",
            lat: r.latitude,
            lng: r.longitude,
          };
        const l = byLead.get(id);
        if (l)
          return {
            id: l.id,
            name: l.companyName,
            address: l.address,
            lat: l.latitude,
            lng: l.longitude,
          };
        return null;
      })
      .filter((t): t is RouteTarget => t !== null);
  }, [selected, discovery, leadPage]);

  const ordered = useMemo<OrderedStop[]>(
    () => optimizeVisitOrder(targets, origin ?? undefined),
    [targets, origin],
  );

  const byId = useMemo(() => new Map(targets.map((t) => [t.id, t])), [targets]);
  const totalKm = ordered.reduce((s, o) => s + o.legKm, 0);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocalização não disponível neste navegador.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        toast.error("Não foi possível obter sua localização. Verifique a permissão do navegador.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const openRoute = () => {
    const url = buildGoogleMapsRouteUrl(ordered, origin ?? undefined);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const openStopInWaze = (stop: OrderedStop) => {
    window.open(buildWazeNavigationUrl(stop), "_blank", "noopener,noreferrer");
  };

  if (targets.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Planejar rota ({targets.length})</DialogTitle>
          <DialogDescription>
            Google Maps recebe a rota completa; no Waze, abra cada parada na ordem sugerida.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-md border bg-muted/30 p-2.5 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <MapPinned className="h-3.5 w-3.5" />
            {origin ? "Partindo da sua localização atual" : "Partindo da primeira parada da lista"}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={useCurrentLocation}
            disabled={locating}
          >
            {locating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
            {origin ? "Atualizar localização" : "Usar minha localização"}
          </Button>
        </div>

        <div className="max-h-[360px] space-y-2 overflow-y-auto">
          {ordered.map((stop, i) => {
            const t = byId.get(stop.id);
            if (!t) return null;
            return (
              <div key={stop.id} className="flex items-start gap-3 rounded-md border p-2.5">
                <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{t.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{t.address}</p>
                </div>
                <span className="shrink-0 text-micro text-muted-foreground">
                  {i === 0 && !origin ? "início" : `+${stop.legKm.toFixed(1)}km`}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 shrink-0 px-2 text-caption"
                  onClick={() => openStopInWaze(stop)}
                  aria-label={`Abrir ${t.name} no Waze`}
                >
                  Waze
                </Button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <p className="text-xs text-muted-foreground">
            {origin
              ? `~${totalKm.toFixed(1)}km no total, a partir de onde você está`
              : `~${totalKm.toFixed(1)}km entre paradas`}
          </p>
          <Button size="sm" onClick={openRoute} className="gap-1.5">
            <Navigation className="h-3.5 w-3.5" />
            Abrir no Google Maps
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
