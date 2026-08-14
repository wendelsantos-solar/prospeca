import { useState, useEffect, useRef, useMemo } from "react";
import { Search, Loader2, MapPin, X, Locate, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { NICHES } from "@/lib/constants";
import { historyService, type SearchInput } from "@/services";
import { useLeadsStore, useLocationStore, useSearchDraftStore, useSettingsStore } from "@/stores";
import { useSearchSession } from "@/stores/searchSession";
import { distanceKm } from "@/lib/geo";
import { buildMissionPhrase } from "@/lib/mission";
import { MissionInput } from "./MissionInput";
import { useIsDirty } from "@/hooks/useIsDirty";
import { useSearchMutation } from "@/hooks/useSearchMutation";
import { useGeolocation } from "@/hooks/useGeolocation";
import { reverseGeocodeCoords, geocodeLocationText } from "@/lib/reverse-geocode";
import { toast } from "sonner";
import { pushRecentAction } from "@/lib/recent-actions";
import type { PresenceFilter } from "@/types";
import { isRealMode } from "@/lib/env";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { useActivationStore } from "@/stores/activation";
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
      aria-label="Usar minha localização"
      title="Usar minha localização"
      className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {status === "prompting" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Locate className="h-3.5 w-3.5" />
      )}
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

  // Deterministic "missão de prospecção" — friendly interpretation of the
  // chosen filters (no LLM; derived purely from what the user picked).
  const mission = useMemo(
    () => buildMissionPhrase({ niche, location, presence, radiusKm: radius }),
    [niche, location, presence, radius],
  );

  const leads = useLeadsStore((s) => s.leads);
  const markMilestone = useActivationStore((state) => state.mark);
  const leadsInRadius = useMemo(
    () =>
      leads.filter(
        (l) => distanceKm(draft.coords, { lat: l.latitude, lng: l.longitude }) <= draft.radiusKm,
      ).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on coords primitives (lat/lng) to avoid object-ref churn
    [leads, draft.coords.lat, draft.coords.lng, draft.radiusKm],
  );

  const { dirty, reason } = useIsDirty();
  const hasResults = useLeadsStore((s) => s.currentSearch) != null;

  // Filtro de presença padrão (Configurações → Prospecção) inicializa o draft.
  // Só aplica quando não há busca ativa, para não sobrescrever uma busca em
  // andamento. Assim a config passa a valer de fato (default = "Todos").
  const defaultPresence = useSettingsStore((s) => s.defaultPresence);
  useEffect(() => {
    if (!hasResults) setDraft({ presence: defaultPresence });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setDraft is stable
  }, [defaultPresence, hasResults]);

  const [nicheOpen, setNicheOpen] = useState(false);
  const [locOpen, setLocOpen] = useState(false);
  const [locGeocoding, setLocGeocoding] = useState(false);
  const nicheButtonRef = useRef<HTMLButtonElement | null>(null);

  const suggestions = historyService.suggestLocation(location);

  // Nenhuma sugestão bate (ex: rua/endereço digitado) — resolve via Google
  // Geocoding (mesma function/cache do GPS), igual buscar um endereço no Maps.
  async function useTypedLocation() {
    const text = useSearchDraftStore.getState().draft.location.trim();
    if (text.length < 2 || locGeocoding) return;
    setLocGeocoding(true);
    const geo = await geocodeLocationText(text);
    setLocGeocoding(false);
    if (!geo) {
      toast.error("Endereço não encontrado. Tente outro texto.");
      return;
    }
    setDraft({ location: geo.label, coords: { lat: geo.latitude, lng: geo.longitude } });
    setLocOpen(false);
  }

  // Phase 4 — Real search: uses repository (demo keeps mock behavior)
  const { run, cancel, loading, progress } = useSearchMutation({
    onSuccess: (leads, search) => {
      setLeads(leads, search);
      setSearching(false);
      pushRecentAction(`${search.totalFound} leads encontrados`);
      toast.success(
        isRealMode
          ? `${search.totalFound} empresas encontradas`
          : `${leads.length} empresas encontradas`,
      );
      track("search_completed", { niche: search.niche, totalFound: search.totalFound });
      markMilestone("firstSearch", { niche: search.niche, totalFound: search.totalFound });
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
    // Guard: never run a search without a region — the initial draft coords are
    // (0,0) (the ocean), and searching there is silent nonsense. Require a real
    // location text before firing.
    if (!(input?.location ?? current.location).trim()) {
      toast.error("Escolha uma região para buscar.");
      return;
    }
    const payload: SearchInput = {
      niche: input?.niche ?? current.niche,
      location: input?.location ?? current.location,
      latitude: input?.latitude ?? current.coords.lat,
      longitude: input?.longitude ?? current.coords.lng,
      radiusKm: input?.radiusKm ?? current.radiusKm,
      presence: input?.presence ?? current.presence,
      forceRefresh: input?.forceRefresh,
    };
    setSearching(true);
    setSearchError(null);
    if (!useLeadsStore.getState().currentSearch) {
      track("first_search_started", { niche: payload.niche, location: payload.location });
    }
    run(payload);
  }

  // Auto-busca: dispara sozinha ~700ms depois que local/raio-pra-cima/presença
  // mudam (mudanças discretas e deliberadas). NÃO dispara enquanto o NICHO está
  // sendo digitado — buscar a cada tecla ("barbe" antes de "barbearia") era ruim
  // e desperdiçava busca. O nicho só busca no COMMIT (selecionar da lista /
  // "Usar X" / botão Buscar). `dirty` já exclui mudanças client-only (raio↓).
  useEffect(() => {
    if (!dirty || loading) return;
    // Nicho e localização buscam só no COMMIT (selecionar da lista / "Usar X" /
    // botão), nunca a cada tecla. `location-text` = digitando o endereço sem
    // coordenada resolvida ainda; `location` (coords movidas) é commit e busca.
    if (reason === "niche" || reason === "location-text") return;
    // Sem nicho não há o que buscar — o backend rejeita (query min 2 chars) e
    // o botão já fica desabilitado; o auto-busca não deve tentar mesmo assim.
    if (draft.niche.trim().length < 2) return;
    const timer = setTimeout(() => runSearch(), 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-arm on any draft change while dirty; runSearch reads fresh state itself
  }, [draft, dirty, reason, loading]);

  // Register imperative search actions with the session store (C5: replaces window event bus).
  // Components call useSearchSession().suggestSearch(...) instead of dispatching CustomEvents.
  useEffect(() => {
    // Retornante: hidrata os campos com a última localização escolhida.
    const last = useLocationStore.getState().lastLocation;
    if (last) setDraft({ location: last.label, coords: { lat: last.lat, lng: last.lng } });

    const register = useSearchSession.getState().register;
    register({
      runSearch: (input) => runSearch(input),
      setDraft: (patch) => setDraft(patch as Parameters<typeof setDraft>[0]),
      // Open the niche combobox (not just focus it) so the global ⌘K search and
      // the "start a search" affordances land the user straight in a typeable
      // field — focusing the trigger alone opened nothing visible.
      focusNiche: () => {
        nicheButtonRef.current?.focus();
        setNicheOpen(true);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-2.5">
      <MissionInput />
      {mission && (
        <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary-subtle px-3 py-2">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <p className="text-[12px] leading-snug text-foreground">
            <span className="font-semibold text-primary">Missão:</span> {mission}
          </p>
        </div>
      )}
      <div>
        <Popover open={nicheOpen} onOpenChange={setNicheOpen}>
          <PopoverTrigger asChild>
            <Button
              ref={nicheButtonRef}
              variant="outline"
              role="combobox"
              aria-expanded={nicheOpen}
              className="h-auto w-full items-center justify-start gap-2 rounded-lg border border-border bg-surface px-2.5 py-2 font-normal shadow-none hover:bg-surface focus-visible:ring-2 focus-visible:ring-primary/15"
            >
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Nicho
                </span>
                <span className="block truncate text-[13px] text-foreground">
                  {niche || (
                    <span className="text-muted-foreground/70">ex: barbearia, restaurante</span>
                  )}
                </span>
              </span>
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
                    onClick={() => {
                      setNicheOpen(false);
                      if (useSearchDraftStore.getState().draft.location.trim())
                        runSearch({ niche });
                    }}
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
                        // Commit do nicho = buscar (se já há localização).
                        if (useSearchDraftStore.getState().draft.location.trim())
                          runSearch({ niche: v });
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

      <div className="flex items-center gap-1 rounded-lg border border-border bg-surface pr-1.5 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
        <Popover open={locOpen} onOpenChange={setLocOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left"
            >
              <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Localização
                </span>
                <span className="block truncate text-[13px] text-foreground">
                  {location || (
                    <span className="text-muted-foreground/70">Cidade, bairro ou endereço</span>
                  )}
                </span>
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command>
              <CommandInput
                placeholder="Cidade, bairro ou endereço..."
                value={location}
                onValueChange={(v) => setDraft({ location: v })}
              />
              <CommandList>
                <CommandEmpty>
                  <button
                    type="button"
                    className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={location.trim().length < 2 || locGeocoding}
                    onClick={useTypedLocation}
                  >
                    {locGeocoding ? "Buscando endereço..." : `Usar "${location}"`}
                  </button>
                </CommandEmpty>
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

      <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-medium text-muted-foreground">Raio de busca</span>
          <span className="rounded-md bg-primary-soft px-1.5 py-0.5 text-[11px] font-semibold text-primary tabular-nums">
            {radius} km
          </span>
        </div>
        <Slider
          value={[radius]}
          onValueChange={(v) => setDraft({ radiusKm: v[0]! })}
          min={1}
          max={100}
          step={1}
          aria-label="Raio de busca"
        />
        {leads.length > 0 && (
          <p className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">
            ~{leadsInRadius} de {leads.length} empresas neste raio
          </p>
        )}
      </div>

      <div>
        <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">Presença digital</div>
        <div
          className="grid grid-cols-3 gap-1 rounded-lg border bg-muted/40 p-0.5"
          role="group"
          aria-label="Filtro de presença digital"
        >
          {(
            [
              { v: "all", l: "Todas" },
              { v: "no-website", l: "Sem site" },
              { v: "with-website", l: "Com site" },
            ] as const
          ).map((o) => (
            <button
              key={o.v}
              onClick={() => setDraft({ presence: o.v })}
              aria-pressed={presence === o.v}
              className={cn(
                "text-xs font-medium rounded-md px-2 py-1.5 transition-colors",
                presence === o.v
                  ? "bg-surface text-foreground shadow-card"
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
        disabled={loading || niche.trim().length < 2}
        size="lg"
        className={cn(
          "w-full gap-2 shadow-card",
          dirty && hasResults && "bg-amber-500 hover:bg-amber-600 text-white",
        )}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        {loading ? "Buscando…" : dirty && hasResults ? "Atualizar busca" : "Buscar oportunidades"}
      </Button>
      {!loading && niche.trim().length < 2 && (
        <p className="text-[11px] text-muted-foreground text-center -mt-1.5">
          Informe o nicho pra buscar
        </p>
      )}
      {!loading && niche.trim().length >= 2 && dirty && hasResults && (
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
          {progress.estimate && (
            <p className="text-[11px] text-muted-foreground">
              <span className="font-medium">Estimativa:</span> ~{progress.estimate.resultsMin}–
              {progress.estimate.resultsMax} resultados · US${" "}
              {progress.estimate.costUsdMin.toFixed(4)}–{progress.estimate.costUsdMax.toFixed(4)}
              {progress.estimate.costUsdMax === 0 ? " (cache — custo zero)" : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
