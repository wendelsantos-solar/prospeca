import { useState, useEffect, useRef, useMemo } from "react";
import { Search, Loader2, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { NICHES, RADIUS_OPTIONS } from "@/lib/constants";
import { historyService, type SearchInput } from "@/services";
import { useLeadsStore, useLocationStore, useSearchDraftStore } from "@/stores";
import { distanceKm } from "@/lib/geo";
import { useIsDirty } from "@/hooks/useIsDirty";
import { useSearchMutation } from "@/hooks/useSearchMutation";
import { useGeolocation } from "@/hooks/useGeolocation";
import { reverseGeocodeCoords } from "@/lib/reverse-geocode";
import { toast } from "sonner";
import type { PresenceFilter } from "@/types";
import { isRealMode } from "@/lib/env";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface SuggestSearchDetail {
  niche: string;
  location: string;
  lat: number;
  lng: number;
  presence: PresenceFilter;
  radiusKm?: number;
}

function GpsButton({
  radiusKm,
  onLocated,
}: {
  radiusKm: number;
  onLocated: (label: string, lat: number, lng: number) => void;
}) {
  const setPreviewLocation = useLeadsStore((s) => s.setPreviewLocation);
  const setLastLocation = useLocationStore((s) => s.setLastLocation);
  const { status, request, supported } = useGeolocation((coords) => {
    setPreviewLocation({ lat: coords.lat, lng: coords.lng, radiusKm, label: "Localizando..." });
    onLocated("Localizando...", coords.lat, coords.lng);
    reverseGeocodeCoords(coords.lat, coords.lng).then((resolved) => {
      const label = resolved ?? "Minha localização";
      setPreviewLocation({ lat: coords.lat, lng: coords.lng, radiusKm, label });
      setLastLocation({ label, lat: coords.lat, lng: coords.lng });
      onLocated(label, coords.lat, coords.lng);
    });
  });
  useEffect(() => {
    if (status === "denied" || status === "error") {
      toast.error("Sem acesso à localização — escolha uma cidade.");
    }
  }, [status]);
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={request}
      className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-primary hover:underline"
    >
      {status === "prompting" ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <MapPin className="h-3 w-3" />
      )}
      Usar minha localização
    </button>
  );
}

export function SearchForm() {
  const setLeads = useLeadsStore((s) => s.setLeads);
  const setSearching = useLeadsStore((s) => s.setSearching);
  const setSearchError = useLeadsStore((s) => s.setSearchError);
  const draft = useSearchDraftStore((s) => s.draft);
  const setDraft = useSearchDraftStore((s) => s.setDraft);
  const niche = draft.niche;
  const location = draft.location;
  const locCoords = draft.coords;
  const presence = draft.presence;
  const radius = draft.radiusKm;
  const sliderIndex = Math.max(
    0,
    RADIUS_OPTIONS.indexOf(radius as (typeof RADIUS_OPTIONS)[number]),
  );

  const leads = useLeadsStore((s) => s.leads);
  const leadsInRadius = useMemo(
    () =>
      leads.filter(
        (l) => distanceKm(draft.coords, { lat: l.latitude, lng: l.longitude }) <= draft.radiusKm,
      ).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on coords primitives (lat/lng) to avoid object-ref churn
    [leads, draft.coords.lat, draft.coords.lng, draft.radiusKm],
  );

  const { dirty } = useIsDirty();
  const hasResults = useLeadsStore((s) => s.currentSearch) != null;

  const [nicheOpen, setNicheOpen] = useState(false);
  const [locOpen, setLocOpen] = useState(false);
  const nicheButtonRef = useRef<HTMLButtonElement | null>(null);

  const suggestions = historyService.suggestLocation(location);

  // Phase 4 — Real search: uses repository (demo keeps mock behavior)
  const { run, cancel, loading, progress } = useSearchMutation({
    onSuccess: (leads, search) => {
      setLeads(leads, search);
      setSearching(false);
      toast.success(
        isRealMode
          ? `${search.totalFound} empresas encontradas`
          : `${leads.length} empresas encontradas`,
      );
    },
    onError: (msg) => {
      setSearchError(msg);
      setSearching(false);
      toast.error(msg);
    },
  });

  function runSearch(input?: Partial<SearchInput>) {
    // Read fresh from the store (not the render-scope consts above) so calls from
    // the "retry-search"/"radar-search" listeners — registered once on mount — never
    // resubmit a stale draft after the user changes niche/location/radius.
    const current = useSearchDraftStore.getState().draft;
    const payload: SearchInput = {
      niche: input?.niche ?? current.niche,
      location: input?.location ?? current.location,
      latitude: input?.latitude ?? current.coords.lat,
      longitude: input?.longitude ?? current.coords.lng,
      radiusKm: input?.radiusKm ?? current.radiusKm,
      presence: input?.presence ?? current.presence,
    };
    setSearching(true);
    setSearchError(null);
    run(payload);
  }

  // Auto-busca: dispara sozinha ~700ms depois que nicho/local/raio-pra-cima/
  // presença mudam o suficiente pra exigir busca nova no servidor (`dirty` já
  // exclui mudanças client-only, tipo raio pra baixo — ver classifyDirty).
  // OSM não tem custo por request, então não precisa mais gate manual: exigir
  // clique em "Atualizar busca" só causava confusão (resultado da busca antiga
  // ficava na tela parecendo bater com o nicho novo já digitado).
  useEffect(() => {
    if (!dirty || loading) return;
    const timer = setTimeout(() => runSearch(), 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-arm on any draft change while dirty; runSearch reads fresh state itself
  }, [draft, dirty, loading]);

  // Eventos globais (home page, histórico, retry, geolocalização).
  useEffect(() => {
    // Retornante: hidrata os campos com a última localização escolhida.
    const last = useLocationStore.getState().lastLocation;
    if (last) setDraft({ location: last.label, coords: { lat: last.lat, lng: last.lng } });

    const onFocusNiche = () => nicheButtonRef.current?.focus();
    const onGeoLocated = (e: Event) => {
      const d = (e as CustomEvent<{ label: string; lat: number; lng: number }>).detail;
      setDraft({ location: d.label, coords: { lat: d.lat, lng: d.lng } });
    };
    const onSuggest = (e: Event) => {
      const d = (e as CustomEvent<SuggestSearchDetail>).detail;
      const radiusKm = d.radiusKm ?? draft.radiusKm;
      setDraft({
        niche: d.niche,
        location: d.location,
        coords: { lat: d.lat, lng: d.lng },
        presence: d.presence,
        radiusKm,
      });
      runSearch({
        niche: d.niche,
        location: d.location,
        latitude: d.lat,
        longitude: d.lng,
        presence: d.presence,
        radiusKm,
      });
    };
    const onRetry = () => runSearch();
    const onRadarSearch = () => runSearch();
    window.addEventListener("focus-niche", onFocusNiche);
    window.addEventListener("suggest-search", onSuggest);
    window.addEventListener("retry-search", onRetry);
    window.addEventListener("radar-search", onRadarSearch);
    window.addEventListener("geo-located", onGeoLocated);
    return () => {
      window.removeEventListener("focus-niche", onFocusNiche);
      window.removeEventListener("suggest-search", onSuggest);
      window.removeEventListener("retry-search", onRetry);
      window.removeEventListener("radar-search", onRadarSearch);
      window.removeEventListener("geo-located", onGeoLocated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">Nicho</Label>
        <Popover open={nicheOpen} onOpenChange={setNicheOpen}>
          <PopoverTrigger asChild>
            <Button
              ref={nicheButtonRef}
              variant="outline"
              role="combobox"
              aria-expanded={nicheOpen}
              className="w-full justify-between font-normal h-9"
            >
              <span className="truncate">{niche || "Selecione um nicho"}</span>
              <Search className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command>
              <CommandInput
                placeholder="Buscar ou digitar categoria..."
                value={niche}
                onValueChange={(v) => setDraft({ niche: v })}
              />
              <CommandList>
                <CommandEmpty>
                  <button
                    className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded"
                    onClick={() => setNicheOpen(false)}
                  >
                    Usar "{niche}"
                  </button>
                </CommandEmpty>
                <CommandGroup>
                  {NICHES.map((n) => (
                    <CommandItem
                      key={n}
                      value={n}
                      onSelect={(v) => {
                        setDraft({ niche: v });
                        setNicheOpen(false);
                      }}
                    >
                      {n}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">Localização</Label>
        <Popover open={locOpen} onOpenChange={setLocOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-between font-normal h-9">
              <span className="flex items-center gap-2 truncate">
                <MapPin className="h-3.5 w-3.5 opacity-60" />
                <span className="truncate">{location}</span>
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command>
              <CommandInput
                placeholder="Cidade, bairro ou endereço..."
                value={location}
                onValueChange={(v) => setDraft({ location: v })}
              />
              <CommandList>
                <CommandEmpty>Nenhuma sugestão</CommandEmpty>
                <CommandGroup>
                  {suggestions.map((c) => (
                    <CommandItem
                      key={c.label}
                      value={c.label}
                      onSelect={() => {
                        setDraft({ location: c.label, coords: { lat: c.lat, lng: c.lng } });
                        setLocOpen(false);
                      }}
                    >
                      <MapPin className="mr-2 h-3.5 w-3.5 opacity-60" />
                      {c.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <GpsButton
          radiusKm={radius}
          onLocated={(label, lat, lng) => {
            setDraft({ location: label, coords: { lat, lng } });
          }}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-muted-foreground">Raio de busca</Label>
          <span className="text-xs font-semibold tabular-nums">{radius} km</span>
        </div>
        <Slider
          value={[sliderIndex]}
          onValueChange={(v) => setDraft({ radiusKm: RADIUS_OPTIONS[v[0]!]! })}
          min={0}
          max={RADIUS_OPTIONS.length - 1}
          step={1}
          aria-label="Raio de busca"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground/70 tabular-nums">
          {RADIUS_OPTIONS.map((r) => (
            <span key={r}>{r}</span>
          ))}
        </div>
        {leads.length > 0 && (
          <p className="text-[11px] text-muted-foreground tabular-nums">
            ~{leadsInRadius} de {leads.length} empresas neste raio
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">Presença digital</Label>
        <div
          className="grid grid-cols-3 gap-1 rounded-lg border bg-muted/40 p-0.5"
          role="group"
          aria-label="Filtro de presença digital"
        >
          {(
            [
              { v: "no-website", l: "Sem site" },
              { v: "with-website", l: "Com site" },
              { v: "all", l: "Todos" },
            ] as const
          ).map((o) => (
            <button
              key={o.v}
              onClick={() => setDraft({ presence: o.v })}
              aria-pressed={presence === o.v}
              className={cn(
                "text-xs font-medium rounded-md px-2 py-1.5 transition-colors",
                presence === o.v
                  ? "bg-surface text-foreground shadow-elegant"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>

      <Button
        onClick={() => runSearch()}
        disabled={loading}
        size="lg"
        className={cn(
          "w-full gap-2 shadow-elegant",
          dirty && hasResults && "bg-amber-500 hover:bg-amber-600 text-white",
        )}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        {loading
          ? "Buscando empresas..."
          : dirty && hasResults
            ? "Atualizar busca"
            : "Buscar empresas"}
      </Button>
      {!loading && dirty && hasResults && (
        <p className="text-[11px] text-muted-foreground text-center -mt-1.5">
          Atualizando em instantes — ou clique acima pra já
        </p>
      )}

      {progress && (
        <div
          className="rounded-lg border bg-surface p-3 space-y-2"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">{progress.stepLabel}</span>
            <button
              aria-label="Cancelar busca"
              onClick={() => cancel()}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <Progress value={progress.percent} className="h-1.5" />
          <p className="text-[11px] text-muted-foreground">
            {progress.partialCount} empresas encontradas até agora...
          </p>
        </div>
      )}
    </div>
  );
}
