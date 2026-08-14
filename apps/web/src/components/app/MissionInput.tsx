import { useCallback, useEffect, useMemo, useState } from "react";
import { Sparkles, Search, Loader2 } from "lucide-react";
import { parseSearchIntent, resolveTaxonomy, SEED_TAXONOMY } from "@leads/domain";
import { useSearchDraftStore } from "@/stores";
import { geocodeLocationText } from "@/lib/reverse-geocode";
import { suggestTaxonomy, taxonomyCnaeHint } from "@/lib/taxonomy-suggest";
import { cn } from "@/lib/utils";

const PRESENCE_LABEL: Record<string, string> = {
  "no-website": "com baixa presença digital",
  "with-website": "com site próprio",
  all: "com qualquer presença digital",
};

/** Pausa de digitação antes da interpretação automática rodar (ms). */
const AUTO_INTERPRET_DEBOUNCE_MS = 600;

/**
 * "Missão de busca" — natural-language input (spec #7, #8). Runs the
 * deterministic SearchIntent parser client-side (same code as the server), shows
 * how the mission was interpreted, and fills the structured draft so the user
 * can edit the result. No LLM here; the interpretation is fully transparent.
 */
export function MissionInput() {
  const setDraft = useSearchDraftStore((s) => s.setDraft);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [interpreted, setInterpreted] = useState<ReturnType<typeof parseSearchIntent> | null>(null);
  const [taxonomyName, setTaxonomyName] = useState<string | null>(null);

  // Live suggestions derive ONLY from the taxonomy seed (name + aliases).
  const suggestions = useMemo(() => suggestTaxonomy(text), [text]);
  const showSuggestions = suggestionsOpen && suggestions.length > 0;

  const pickSuggestion = useCallback(
    (entryName: string) => {
      setText(entryName);
      setSuggestionsOpen(false);
      setActiveSuggestion(-1);
      // The suggestion feeds the resolution — it does not replace the
      // deterministic parser below.
      setDraft({ niche: entryName });
    },
    [setDraft],
  );

  useEffect(() => {
    setActiveSuggestion(-1);
  }, [text]);

  const interpret = useCallback(async () => {
    const mission = text.trim();
    if (mission.length < 3) return;

    const intent = parseSearchIntent(mission);
    const taxonomy = resolveTaxonomy(intent.businessIntent, SEED_TAXONOMY);
    setInterpreted(intent);
    setTaxonomyName(taxonomy?.name ?? null);

    // Fill the structured draft (no coords from NL — location is resolved next).
    if (intent.businessIntent) setDraft({ niche: intent.businessIntent });
    setDraft({ presence: intent.presence });
    if (intent.radiusKm != null) setDraft({ radiusKm: intent.radiusKm });

    if (intent.location) {
      setBusy(true);
      const geo = await geocodeLocationText(intent.location);
      setBusy(false);
      if (geo) {
        setDraft({ location: geo.label, coords: { lat: geo.latitude, lng: geo.longitude } });
      } else {
        // Demo mode / geocode miss: keep the label, user confirms the pin.
        setDraft({ location: intent.location });
      }
    }
  }, [text, setDraft]);

  // Auto-interpret: resolve the mission as soon as the user pauses typing, so
  // there's no need to press "Interpretar". The button remains as an instant
  // trigger (and to surface the geocoding spinner) but is not required.
  useEffect(() => {
    const mission = text.trim();
    if (mission.length < 3) {
      setInterpreted(null);
      setTaxonomyName(null);
      return;
    }
    const timer = setTimeout(() => void interpret(), AUTO_INTERPRET_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, interpret]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setSuggestionsOpen(true);
          }}
          onFocus={() => setSuggestionsOpen(true)}
          onBlur={() => {
            // Small delay so a suggestion click registers before closing.
            setTimeout(() => setSuggestionsOpen(false), 150);
          }}
          onKeyDown={(e) => {
            if (showSuggestions && e.key === "ArrowDown") {
              e.preventDefault();
              setActiveSuggestion((i) => Math.min(i + 1, suggestions.length - 1));
              return;
            }
            if (showSuggestions && e.key === "ArrowUp") {
              e.preventDefault();
              setActiveSuggestion((i) => Math.max(i - 1, 0));
              return;
            }
            if (showSuggestions && e.key === "Enter" && activeSuggestion >= 0) {
              e.preventDefault();
              pickSuggestion(suggestions[activeSuggestion]!.name);
              return;
            }
            if (e.key === "Enter") {
              e.preventDefault();
              setSuggestionsOpen(false);
              void interpret();
            }
            if (e.key === "Escape") setSuggestionsOpen(false);
          }}
          placeholder="Quem você quer encontrar? ex: barbearias sem site em Campo Grande"
          className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-8 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/15"
          aria-label="Missão de busca"
          autoComplete="off"
        />
        {busy && (
          <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-primary" />
        )}

        {showSuggestions && (
          <ul
            role="listbox"
            aria-label="Sugestões de nicho"
            className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-border bg-surface shadow-elevated"
          >
            {suggestions.map((t, i) => {
              const cnae = taxonomyCnaeHint(t);
              return (
                <li key={t.slug}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === activeSuggestion}
                    onMouseEnter={() => setActiveSuggestion(i)}
                    onMouseDown={(e) => {
                      // Fire before the input blur closes the list.
                      e.preventDefault();
                      pickSuggestion(t.name);
                    }}
                    className={cn(
                      "flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left",
                      i === activeSuggestion ? "bg-muted/80" : "hover:bg-muted/60",
                    )}
                  >
                    <span className="text-[12.5px] font-medium text-foreground">{t.name}</span>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {cnae ? `CNAE ${cnae}` : t.placesTypes.slice(0, 2).join(", ")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {interpreted && (
        <div className="rounded-lg border border-primary/20 bg-primary-subtle px-3 py-2">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-primary">
            <Sparkles className="h-3 w-3" /> IA entendeu sua missão
          </p>
          <p className="mt-1 text-[12px] leading-snug text-foreground">
            <span
              className={cn(
                "font-semibold",
                !interpreted.businessIntent && "text-muted-foreground",
              )}
            >
              {interpreted.businessIntent || "nicho não identificado"}
            </span>
            {" · "}
            {PRESENCE_LABEL[interpreted.presence]}
            {interpreted.location ? ` · em ${interpreted.location}` : ""}
            {interpreted.ratingMin != null ? ` · nota ≥ ${interpreted.ratingMin}` : ""}
            {interpreted.radiusKm != null ? ` · raio ${interpreted.radiusKm} km` : ""}
          </p>
          {taxonomyName && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Nicho sugerido: <span className="font-medium text-foreground">{taxonomyName}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
