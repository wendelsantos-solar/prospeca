import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Crosshair,
  Globe2,
  Loader2,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { LogoMark } from "@/components/shared/LogoMark";
import { useDiscoveryResults } from "@/hooks/useLeadsQuery";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useSearchMutation } from "@/hooks/useSearchMutation";
import type { OnboardingProgress } from "@/hooks/useOnboarding";
import { track } from "@/lib/analytics";
import { categoryLabel } from "@/lib/category";
import { CITY_SUGGESTIONS, NICHES } from "@/lib/constants";
import { geocodeLocationText, reverseGeocodeCoords } from "@/lib/reverse-geocode";
import { cn } from "@/lib/utils";
import { useActivationStore } from "@/stores/activation";
import { useLeadsStore, useLocationStore, useSearchDraftStore } from "@/stores";
import type { Lead, PresenceFilter, Search as SearchResult } from "@/types";

export type { OnboardingProgress } from "@/hooks/useOnboarding";

interface OnboardingWizardProps {
  onComplete: (progress: OnboardingProgress) => void;
  onSkip: () => void;
  initialProgress?: OnboardingProgress;
  onSaveProgress: (progress: OnboardingProgress) => void;
}

interface ResultPreview {
  id: string;
  name: string;
  category: string | null;
  score: number;
  distanceKm: number;
  hasWebsite: boolean;
  hasWhatsapp: boolean;
  hasPhone: boolean;
}

const PRESENCE_OPTIONS: Array<{
  value: PresenceFilter;
  label: string;
  description: string;
}> = [
  { value: "no-website", label: "Sem site", description: "Maior oportunidade digital" },
  { value: "all", label: "Todas", description: "Visão completa da região" },
  { value: "with-website", label: "Com site", description: "Empresas já estruturadas" },
];

const FEATURED_NICHES = NICHES.slice(0, 8);
const STEP_LABELS = ["Tipo de empresa", "Região", "Oportunidades"];

function scoreReasons(result: ResultPreview): string[] {
  const reasons: string[] = [];
  if (!result.hasWebsite) reasons.push("sem site");
  if (result.hasWhatsapp) reasons.push("WhatsApp disponível");
  else if (result.hasPhone) reasons.push("telefone disponível");
  if (result.distanceKm <= 5) reasons.push(`${result.distanceKm.toFixed(1)} km de distância`);
  return reasons.slice(0, 3);
}

function StepProgress({ step }: { step: number }) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="grid grid-cols-3 gap-2" aria-label={`Passo ${step + 1} de 3`}>
        {STEP_LABELS.map((label, index) => (
          <div key={label}>
            <div
              className={cn(
                "h-1.5 rounded-full transition-colors",
                index <= step ? "bg-primary" : "bg-border",
              )}
            />
            <p
              className={cn(
                "mt-2 text-center text-[11px] font-medium",
                index === step ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OnboardingWizard({
  onComplete,
  onSkip,
  initialProgress,
  onSaveProgress,
}: OnboardingWizardProps) {
  const saved = initialProgress?.searchDraft;
  const [step, setStep] = useState(saved ? Math.min(initialProgress?.step ?? 0, 1) : 0);
  const [niche, setNiche] = useState(saved?.niche ?? "");
  const [presence, setPresence] = useState<PresenceFilter>(saved?.presence ?? "no-website");
  const [location, setLocation] = useState(saved?.location ?? "");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    saved?.latitude != null && saved.longitude != null
      ? { lat: saved.latitude, lng: saved.longitude }
      : null,
  );
  const [radiusKm, setRadiusKm] = useState(saved?.radiusKm ?? 10);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [resolvingLocation, setResolvingLocation] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchId, setSearchId] = useState<string | null>(null);
  const [searchSummary, setSearchSummary] = useState<SearchResult | null>(null);
  const [demoResults, setDemoResults] = useState<Lead[]>([]);

  const setLeads = useLeadsStore((state) => state.setLeads);
  const setSearching = useLeadsStore((state) => state.setSearching);
  const setSearchStoreError = useLeadsStore((state) => state.setSearchError);
  const setDraft = useSearchDraftStore((state) => state.setDraft);
  const setLastLocation = useLocationStore((state) => state.setLastLocation);
  const markMilestone = useActivationStore((state) => state.mark);
  const { data: discoveryResults = [], isFetching: loadingDiscovery } = useDiscoveryResults(
    searchId ?? undefined,
  );

  const draft: NonNullable<OnboardingProgress["searchDraft"]> = useMemo(
    () => ({
      niche,
      presence,
      location,
      latitude: coords?.lat,
      longitude: coords?.lng,
      radiusKm,
    }),
    [niche, presence, location, coords, radiusKm],
  );

  useEffect(() => {
    onSaveProgress({
      step,
      completed: false,
      skippedSteps: initialProgress?.skippedSteps ?? [],
      searchDraft: draft,
      milestones: initialProgress?.milestones,
    });
    // The caller passes a fresh save closure; progress should change only when
    // the onboarding data changes, not when that closure is recreated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, draft]);

  const handleSearchSuccess = useCallback(
    (leads: Lead[], search: SearchResult) => {
      setLeads(leads, search);
      setSearching(false);
      setDemoResults(leads);
      setSearchId(search.id);
      setSearchSummary(search);
      markMilestone("firstSearch", {
        niche: search.niche,
        totalFound: search.totalFound,
      });
      track("search_completed", { niche: search.niche, totalFound: search.totalFound });
    },
    [markMilestone, setLeads, setSearching],
  );

  const { run, loading, progress } = useSearchMutation({
    onSuccess: handleSearchSuccess,
    onError: (message) => {
      setSearching(false);
      setSearchError(message);
      setSearchStoreError(message);
    },
  });

  const applyLocation = useCallback(
    (label: string, latitude: number, longitude: number) => {
      setLocation(label);
      setCoords({ lat: latitude, lng: longitude });
      setLocationError(null);
      setLastLocation({ label, lat: latitude, lng: longitude });
    },
    [setLastLocation],
  );

  const {
    status: geoStatus,
    request: requestGeolocation,
    supported: geolocationSupported,
  } = useGeolocation((position) => {
    applyLocation("Minha localização", position.lat, position.lng);
    void reverseGeocodeCoords(position.lat, position.lng).then((label) => {
      if (label) applyLocation(label, position.lat, position.lng);
    });
  });

  const previews: ResultPreview[] = useMemo(() => {
    if (discoveryResults.length > 0) {
      return discoveryResults.map((result) => ({
        id: result.placeId,
        name: result.name,
        category: result.category,
        score: result.score,
        distanceKm: result.distanceKm,
        hasWebsite: result.hasWebsite,
        hasWhatsapp: !!result.whatsapp,
        hasPhone: !!result.phone,
      }));
    }
    return demoResults.map((lead) => ({
      id: lead.id,
      name: lead.companyName,
      category: lead.category,
      score: lead.score,
      distanceKm: lead.distanceKm,
      hasWebsite: lead.hasWebsite,
      hasWhatsapp: !!lead.whatsapp,
      hasPhone: !!lead.phone,
    }));
  }, [discoveryResults, demoResults]);

  const totalFound = searchSummary?.totalFound ?? previews.length;
  const highOpportunity = previews.filter((result) => result.score >= 75).length;
  const withWhatsapp = previews.filter((result) => result.hasWhatsapp).length;
  const withoutWebsite = previews.filter((result) => !result.hasWebsite).length;

  const startSearch = async () => {
    setSearchError(null);
    setLocationError(null);
    let resolvedCoords = coords;
    let resolvedLabel = location.trim();

    if (!resolvedCoords) {
      setResolvingLocation(true);
      const geocoded = await geocodeLocationText(resolvedLabel);
      setResolvingLocation(false);
      if (!geocoded) {
        setLocationError("Não encontramos essa região. Escolha uma sugestão ou tente novamente.");
        return;
      }
      resolvedCoords = { lat: geocoded.latitude, lng: geocoded.longitude };
      resolvedLabel = geocoded.label;
      applyLocation(resolvedLabel, resolvedCoords.lat, resolvedCoords.lng);
    }

    const input = {
      niche: niche.trim(),
      location: resolvedLabel,
      latitude: resolvedCoords.lat,
      longitude: resolvedCoords.lng,
      radiusKm,
      presence,
    };

    setDraft({
      niche: input.niche,
      location: input.location,
      coords: { lat: input.latitude, lng: input.longitude },
      radiusKm,
      presence,
    });
    setStep(2);
    setSearching(true);
    setSearchStoreError(null);
    track("first_search_started", { niche: input.niche, location: input.location });
    run(input);
  };

  const finish = () => {
    const progressState: OnboardingProgress = {
      step: 2,
      completed: true,
      skippedSteps: initialProgress?.skippedSteps ?? [],
      searchDraft: draft,
      milestones: {
        ...initialProgress?.milestones,
        firstSearch: true,
        firstLeadViewed: initialProgress?.milestones?.firstLeadViewed ?? false,
        firstLeadAdded: initialProgress?.milestones?.firstLeadAdded ?? false,
        firstMessagePrepared: initialProgress?.milestones?.firstMessagePrepared ?? false,
      },
    };
    onSaveProgress(progressState);
    track("onboarding_completed", { totalSteps: 3, totalFound });
    onComplete(progressState);
  };

  const skip = () => {
    const skippedProgress: OnboardingProgress = {
      step,
      completed: true,
      skippedSteps: ["guided_activation"],
      searchDraft: draft,
      milestones: initialProgress?.milestones,
    };
    onSaveProgress(skippedProgress);
    track("onboarding_skipped", { step: STEP_LABELS[step], stepNumber: step + 1 });
    onSkip();
  };

  return (
    <div className="min-h-dvh w-full min-w-0 flex-1 overflow-y-auto bg-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-[10px] bg-gradient-to-br from-primary to-primary-hover text-primary-foreground shadow-card">
            <LogoMark className="h-[18px] w-[18px]" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">Prospeca</span>
        </div>
        <Button variant="ghost" size="sm" onClick={skip} className="text-muted-foreground">
          Explorar sozinho
        </Button>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6">
        <StepProgress step={step} />

        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface shadow-elegant sm:mt-8">
          {step === 0 && (
            <div className="grid min-h-[560px] lg:grid-cols-[1.08fr_0.92fr]">
              <div className="p-6 sm:p-9 lg:p-12">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                  Sua primeira busca
                </p>
                <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  Quem você quer encontrar?
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  Escolha um tipo de empresa. A Prospeca vai mostrar quais negócios merecem sua
                  atenção primeiro — e por quê.
                </p>

                <div className="mt-7">
                  <label htmlFor="onboarding-niche" className="text-sm font-medium text-foreground">
                    Tipo de empresa
                  </label>
                  <div className="relative mt-2">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="onboarding-niche"
                      value={niche}
                      onChange={(event) => setNiche(event.target.value)}
                      placeholder="Ex.: barbearia, clínica, contabilidade"
                      className="h-12 rounded-xl pl-10 text-base"
                      autoFocus
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {FEATURED_NICHES.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setNiche(item)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                          niche === item
                            ? "border-primary bg-primary-soft text-primary"
                            : "border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground",
                        )}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                <fieldset className="mt-7">
                  <legend className="text-sm font-medium text-foreground">
                    Que tipo de oportunidade procura?
                  </legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {PRESENCE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setPresence(option.value)}
                        aria-pressed={presence === option.value}
                        className={cn(
                          "rounded-xl border p-3 text-left transition-all",
                          presence === option.value
                            ? "border-primary bg-primary-subtle ring-1 ring-primary/20"
                            : "border-border hover:border-border-strong hover:bg-surface-hover",
                        )}
                      >
                        <span className="block text-sm font-medium text-foreground">
                          {option.label}
                        </span>
                        <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">
                          {option.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="mt-8 flex justify-end">
                  <Button
                    size="lg"
                    className="h-12 px-6"
                    disabled={niche.trim().length < 2}
                    onClick={() => setStep(1)}
                  >
                    Escolher região
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>

              <aside className="hidden border-l border-border bg-surface-2 p-10 lg:flex lg:flex-col lg:justify-center">
                <div className="rounded-2xl border border-border bg-surface p-6 shadow-card">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
                      <Target className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Score de oportunidade</p>
                      <p className="text-xs text-muted-foreground">Você entende cada ponto.</p>
                    </div>
                  </div>
                  <div className="mt-5 space-y-3">
                    {[
                      [Globe2, "Presença digital", "Site e sinais online"],
                      [MessageCircle, "Canais encontrados", "Telefone e WhatsApp"],
                      [MapPin, "Proximidade", "Distância real da região"],
                    ].map(([Icon, title, description]) => {
                      const ItemIcon = Icon as typeof Globe2;
                      return (
                        <div
                          key={String(title)}
                          className="flex items-center gap-3 rounded-xl bg-surface-2 p-3"
                        >
                          <ItemIcon className="h-4 w-4 text-primary" />
                          <div>
                            <p className="text-xs font-medium text-foreground">{String(title)}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {String(description)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <p className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary" />A plataforma sugere. Você decide
                  cada contato.
                </p>
              </aside>
            </div>
          )}

          {step === 1 && (
            <div className="grid min-h-[560px] lg:grid-cols-[1.08fr_0.92fr]">
              <div className="p-6 sm:p-9 lg:p-12">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                  Região de prospecção
                </p>
                <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  Onde deseja prospectar?
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Informe uma cidade, bairro ou endereço para encontrar oportunidades próximas.
                </p>

                <div className="mt-7">
                  <label htmlFor="onboarding-location" className="text-sm font-medium">
                    Região
                  </label>
                  <div className="relative mt-2">
                    <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="onboarding-location"
                      value={location}
                      onChange={(event) => {
                        setLocation(event.target.value);
                        setCoords(null);
                        setLocationError(null);
                      }}
                      placeholder="Cidade, bairro ou endereço"
                      className="h-12 rounded-xl px-10 text-base"
                    />
                    {geolocationSupported && (
                      <button
                        type="button"
                        onClick={requestGeolocation}
                        disabled={geoStatus === "prompting"}
                        className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-primary disabled:opacity-50"
                        aria-label="Usar minha localização"
                        title="Usar minha localização"
                      >
                        {geoStatus === "prompting" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Crosshair className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                  {locationError && (
                    <p role="alert" className="mt-2 text-xs text-destructive">
                      {locationError}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {CITY_SUGGESTIONS.slice(0, 6).map((city) => (
                      <button
                        key={city.label}
                        type="button"
                        onClick={() => applyLocation(city.label, city.lat, city.lng)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                          location === city.label
                            ? "border-primary bg-primary-soft text-primary"
                            : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
                        )}
                      >
                        {city.label.split(",")[0]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-8 rounded-xl border border-border bg-surface-2 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">Raio de busca</p>
                      <p className="text-xs text-muted-foreground">Você poderá ajustar depois.</p>
                    </div>
                    <span className="rounded-lg bg-primary-soft px-2.5 py-1 text-sm font-semibold text-primary tabular-nums">
                      {radiusKm} km
                    </span>
                  </div>
                  <Slider
                    value={[radiusKm]}
                    onValueChange={(value) => setRadiusKm(value[0] ?? 10)}
                    min={1}
                    max={50}
                    step={1}
                    className="mt-5"
                    aria-label="Raio da primeira busca"
                  />
                </div>

                <div className="mt-8 flex items-center justify-between gap-3">
                  <Button variant="ghost" onClick={() => setStep(0)}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar
                  </Button>
                  <Button
                    size="lg"
                    className="h-12 px-6"
                    disabled={location.trim().length < 2 || resolvingLocation}
                    onClick={() => void startSearch()}
                  >
                    {resolvingLocation ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="mr-2 h-4 w-4" />
                    )}
                    {resolvingLocation ? "Localizando…" : "Encontrar oportunidades"}
                  </Button>
                </div>
              </div>

              <aside className="border-t border-border bg-surface-2 p-6 sm:p-9 lg:border-l lg:border-t-0 lg:p-10">
                <div className="flex h-full flex-col justify-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Resumo da busca
                  </p>
                  <div className="mt-4 rounded-2xl border border-border bg-surface p-5 shadow-card">
                    <div className="flex items-start gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-base font-semibold text-foreground">
                          {niche || "Tipo de empresa"}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {PRESENCE_OPTIONS.find((option) => option.value === presence)?.label}
                        </p>
                      </div>
                    </div>
                    <div className="my-4 h-px bg-border" />
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {location || "Escolha uma região"}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Raio de {radiusKm} km
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
                    A busca consulta empresas e organiza os resultados pelo score de oportunidade.
                  </p>
                </div>
              </aside>
            </div>
          )}

          {step === 2 && (
            <div className="min-h-[560px] p-6 sm:p-9 lg:p-12">
              {(loading || resolvingLocation) && !searchSummary ? (
                <div
                  className="mx-auto flex max-w-xl flex-col items-center py-16 text-center"
                  role="status"
                  aria-live="polite"
                >
                  <div className="relative grid h-20 w-20 place-items-center rounded-2xl bg-primary-soft text-primary">
                    <Target className="h-8 w-8" />
                    <span className="absolute inset-0 animate-ping rounded-2xl border border-primary/20" />
                  </div>
                  <h1 className="mt-6 text-2xl font-semibold tracking-tight">
                    Encontrando suas oportunidades
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Analisando {niche.toLowerCase()} em {location}.
                  </p>
                  <div className="mt-8 w-full rounded-xl border border-border bg-surface-2 p-4 text-left">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">
                        {progress?.stepLabel ?? "Preparando a busca…"}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {progress?.percent ?? 5}%
                      </span>
                    </div>
                    <Progress value={progress?.percent ?? 5} className="mt-3 h-2" />
                    <p className="mt-3 text-xs text-muted-foreground">
                      {progress?.partialCount
                        ? `${progress.partialCount} empresas analisadas até agora`
                        : "Consultando empresas e sinais comerciais"}
                    </p>
                  </div>
                </div>
              ) : searchError ? (
                <div className="mx-auto flex max-w-lg flex-col items-center py-16 text-center">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
                    <Search className="h-6 w-6" />
                  </div>
                  <h1 className="mt-5 text-xl font-semibold">Não conseguimos concluir a busca</h1>
                  <p className="mt-2 text-sm text-muted-foreground">{searchError}</p>
                  <Button className="mt-6" variant="outline" onClick={() => setStep(1)}>
                    Ajustar busca
                  </Button>
                </div>
              ) : (
                <div>
                  <div className="mx-auto max-w-2xl text-center">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-success-soft text-success">
                      <Check className="h-6 w-6" strokeWidth={2.3} />
                    </div>
                    <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                      Primeira busca concluída
                    </p>
                    <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                      Encontramos {totalFound} {totalFound === 1 ? "empresa" : "empresas"}
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Agora você já sabe quem merece sua atenção primeiro — e quais sinais explicam
                      essa prioridade.
                    </p>
                  </div>

                  <div className="mx-auto mt-7 grid max-w-3xl grid-cols-3 gap-3">
                    {[
                      [highOpportunity, "alta oportunidade"],
                      [withWhatsapp, "com WhatsApp"],
                      [withoutWebsite, "sem site"],
                    ].map(([value, label]) => (
                      <div
                        key={String(label)}
                        className="rounded-xl border border-border bg-surface-2 p-3 text-center"
                      >
                        <p className="text-xl font-bold text-foreground tabular-nums">{value}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mx-auto mt-7 grid max-w-4xl gap-3 md:grid-cols-3">
                    {previews.slice(0, 3).map((result, index) => {
                      const reasons = scoreReasons(result);
                      return (
                        <article
                          key={result.id}
                          className="rounded-2xl border border-border bg-surface p-4 shadow-card"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[11px] font-medium text-muted-foreground">
                                Oportunidade #{index + 1}
                              </p>
                              <h2 className="mt-1 truncate text-sm font-semibold text-foreground">
                                {result.name}
                              </h2>
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {categoryLabel(result.category)}
                              </p>
                            </div>
                            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-soft">
                              <span className="text-sm font-bold text-primary tabular-nums">
                                {result.score}
                              </span>
                            </div>
                          </div>
                          <div className="mt-4 space-y-2">
                            {reasons.length > 0 ? (
                              reasons.map((reason) => (
                                <p
                                  key={reason}
                                  className="flex items-center gap-2 text-xs text-muted-foreground"
                                >
                                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                                  {reason}
                                </p>
                              ))
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                Abra os detalhes para entender todos os sinais.
                              </p>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  {loadingDiscovery && previews.length === 0 && totalFound > 0 && (
                    <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Organizando as empresas encontradas…
                    </p>
                  )}

                  <div className="mt-8 flex flex-col-reverse items-center justify-center gap-3 sm:flex-row">
                    <Button variant="outline" onClick={() => setStep(0)}>
                      Ajustar busca
                    </Button>
                    <Button
                      size="lg"
                      className="h-12 px-7"
                      onClick={finish}
                      disabled={totalFound === 0}
                    >
                      Ver minhas oportunidades
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                  {totalFound === 0 && (
                    <p className="mt-3 text-center text-xs text-muted-foreground">
                      Ajuste o nicho, a região ou o filtro para ampliar os resultados.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Leva cerca de 2 minutos. Você poderá alterar tudo depois.
        </p>
      </main>
    </div>
  );
}
