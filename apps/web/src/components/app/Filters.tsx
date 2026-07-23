import { useLeadsStore } from "@/stores";
import { useLeadsList } from "@/hooks/useLeadsQuery";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { QUICK_FILTERS, applyFilters } from "@/lib/filters";
import { quickFilterCounts } from "@/lib/filter-counts";
import {
  SORT_OPTIONS,
  STAGE_LABELS,
  STAGE_ORDER,
  TEMPERATURE_LABELS,
  type SortValue,
} from "@/lib/constants";
import { SlidersHorizontal, X, Save, Trash2, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { useMemo, useState } from "react";
import type { LeadFilters, LeadStage, LeadTemperature } from "@/types";
import { toast } from "sonner";

export function QuickFilters() {
  const filters = useLeadsStore((s) => s.filters);
  const leads = useLeadsStore((s) => s.leads);
  const toggle = useLeadsStore((s) => s.toggleQuickFilter);
  const counts = useMemo(() => quickFilterCounts(leads, filters), [leads, filters]);
  const [showAll, setShowAll] = useState(false);

  // Chips at 0 results are just noise until the user actually needs them —
  // keep active ones visible regardless so a toggled-on chip never disappears.
  const hiddenCount = QUICK_FILTERS.filter(
    (f) => (counts[f.id] ?? 0) === 0 && !filters.quick.includes(f.id),
  ).length;
  const visible = QUICK_FILTERS.filter(
    (f) => showAll || (counts[f.id] ?? 0) > 0 || filters.quick.includes(f.id),
  );

  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtros rápidos">
      {visible.map((f) => {
        const active = filters.quick.includes(f.id);
        return (
          <button
            key={f.id}
            onClick={() => toggle(f.id)}
            aria-pressed={active}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface text-muted-foreground hover:border-primary/60 hover:text-foreground",
            )}
          >
            {f.label} <span className="tabular-nums opacity-70">({counts[f.id] ?? 0})</span>
          </button>
        );
      })}
      {!showAll && hiddenCount > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="rounded-full border border-dashed px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          + {hiddenCount} sem resultado
        </button>
      )}
    </div>
  );
}

export function SortSelect() {
  const sort = useLeadsStore((s) => s.sort);
  const setSort = useLeadsStore((s) => s.setSort);
  return (
    <Select value={sort} onValueChange={(v) => setSort(v as SortValue)}>
      <SelectTrigger className="h-8 text-xs w-full" aria-label="Ordenação">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-xs">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function countAdvanced(f: LeadFilters): number {
  let n = 0;
  if (f.minRating != null) n++;
  if (f.minReviews != null) n++;
  if (f.maxDistance != null) n++;
  if (f.minScore != null) n++;
  if (f.maxScore != null) n++;
  if (f.hasPhone) n++;
  if (f.hasWhatsapp) n++;
  if (f.hasInstagram) n++;
  if (f.hasEmail) n++;
  if (f.hasWebsite != null) n++;
  if (f.temperatures?.length) n++;
  if (f.stages?.length) n++;
  if (f.categories?.length) n++;
  if (f.cities?.length) n++;
  if (f.neighborhoods?.length) n++;
  if (f.valueMin != null) n++;
  if (f.valueMax != null) n++;
  if (f.discoveredAfter) n++;
  if (f.lastInteractionAfter) n++;
  if (f.onlyUncontacted) n++;
  if (f.onlyWithTask) n++;
  return n;
}

function toggleInList<T>(list: T[] | undefined, item: T): T[] | undefined {
  const next = list?.includes(item) ? list.filter((x) => x !== item) : [...(list ?? []), item];
  return next.length ? next : undefined;
}

export function AdvancedFilters() {
  const filters = useLeadsStore((s) => s.filters);
  const sort = useLeadsStore((s) => s.sort);

  // CRM real — leads from TanStack Query (Phase 3)
  const { data } = useLeadsList(filters, sort);
  const leads = useMemo(() => data?.items ?? [], [data]);
  const replaceFilters = useLeadsStore((s) => s.replaceFilters);
  const clearFilters = useLeadsStore((s) => s.clearFilters);
  const savedFilters = useLeadsStore((s) => s.savedFilters);
  const saveFilterSet = useLeadsStore((s) => s.saveFilterSet);
  const deleteFilterSet = useLeadsStore((s) => s.deleteFilterSet);

  const activeCount = filters.quick.length + countAdvanced(filters);

  const [draft, setDraft] = useState<LeadFilters>(filters);
  const [open, setOpen] = useState(false);
  const [saveName, setSaveName] = useState("");

  const categories = useMemo(
    () => [...new Set(leads.map((l) => l.category).filter(Boolean))].sort(),
    [leads],
  );
  const cities = useMemo(
    () => [...new Set(leads.map((l) => l.city).filter(Boolean))].sort(),
    [leads],
  );
  const neighborhoods = useMemo(
    () =>
      [
        ...new Set(
          leads
            .filter((l) => !draft.cities?.length || draft.cities.includes(l.city))
            .map((l) => l.neighborhood)
            .filter(Boolean) as string[],
        ),
      ].sort(),
    [leads, draft.cities],
  );

  const previewCount = useMemo(() => applyFilters(leads, draft).length, [leads, draft]);

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setDraft(filters);
      }}
    >
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filtros
          {activeCount > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">
              {activeCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filtros avançados</SheetTitle>
          <SheetDescription>Refine os leads exibidos em todas as visualizações.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 py-4 px-4">
          <FilterField label={`Nota mínima: ${draft.minRating ?? "—"}`}>
            <Slider
              value={[draft.minRating ?? 0]}
              min={0}
              max={5}
              step={0.5}
              onValueChange={([v]) => setDraft((d) => ({ ...d, minRating: v || undefined }))}
              aria-label="Nota mínima"
            />
          </FilterField>
          <FilterField label={`Avaliações mínimas: ${draft.minReviews ?? "—"}`}>
            <Slider
              value={[draft.minReviews ?? 0]}
              min={0}
              max={500}
              step={10}
              onValueChange={([v]) => setDraft((d) => ({ ...d, minReviews: v || undefined }))}
              aria-label="Avaliações mínimas"
            />
          </FilterField>
          <FilterField label={`Distância máxima (km): ${draft.maxDistance ?? "—"}`}>
            <Slider
              value={[draft.maxDistance ?? 100]}
              min={1}
              max={100}
              step={1}
              onValueChange={([v]) => setDraft((d) => ({ ...d, maxDistance: v }))}
              aria-label="Distância máxima"
            />
          </FilterField>
          <div className="grid grid-cols-2 gap-3">
            <FilterField label="Score mínimo">
              <Input
                type="number"
                min={0}
                max={100}
                value={draft.minScore ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    minScore: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
            </FilterField>
            <FilterField label="Score máximo">
              <Input
                type="number"
                min={0}
                max={100}
                value={draft.maxScore ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    maxScore: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
            </FilterField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FilterField label="Valor mínimo (R$)">
              <Input
                type="number"
                value={draft.valueMin ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    valueMin: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
            </FilterField>
            <FilterField label="Valor máximo (R$)">
              <Input
                type="number"
                value={draft.valueMax ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    valueMax: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
            </FilterField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FilterField label="Descoberto após">
              <Input
                type="date"
                value={draft.discoveredAfter ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, discoveredAfter: e.target.value || undefined }))
                }
              />
            </FilterField>
            <FilterField label="Interação após">
              <Input
                type="date"
                value={draft.lastInteractionAfter ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, lastInteractionAfter: e.target.value || undefined }))
                }
              />
            </FilterField>
          </div>

          <FilterField label="Temperatura">
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(TEMPERATURE_LABELS) as LeadTemperature[]).map((t) => (
                <button
                  key={t}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      temperatures: toggleInList(d.temperatures, t) as
                        | LeadTemperature[]
                        | undefined,
                    }))
                  }
                  aria-pressed={draft.temperatures?.includes(t)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                    draft.temperatures?.includes(t)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-surface text-muted-foreground",
                  )}
                >
                  {TEMPERATURE_LABELS[t]}
                </button>
              ))}
            </div>
          </FilterField>
          <FilterField label="Estágio">
            <div className="flex flex-wrap gap-1.5">
              {STAGE_ORDER.map((s) => (
                <button
                  key={s}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      stages: toggleInList(d.stages, s) as LeadStage[] | undefined,
                    }))
                  }
                  aria-pressed={draft.stages?.includes(s)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                    draft.stages?.includes(s)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-surface text-muted-foreground",
                  )}
                >
                  {STAGE_LABELS[s]}
                </button>
              ))}
            </div>
          </FilterField>
          <FilterField label="Categoria">
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() =>
                    setDraft((d) => ({ ...d, categories: toggleInList(d.categories, c) }))
                  }
                  aria-pressed={draft.categories?.includes(c)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                    draft.categories?.includes(c)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-surface text-muted-foreground",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </FilterField>
          <FilterField label="Cidade">
            <div className="flex flex-wrap gap-1.5">
              {cities.map((c) => (
                <button
                  key={c}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      cities: toggleInList(d.cities, c),
                      neighborhoods: undefined,
                    }))
                  }
                  aria-pressed={draft.cities?.includes(c)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                    draft.cities?.includes(c)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-surface text-muted-foreground",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </FilterField>
          {neighborhoods.length > 0 && (
            <FilterField label="Bairro">
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {neighborhoods.map((n) => (
                  <button
                    key={n}
                    onClick={() =>
                      setDraft((d) => ({ ...d, neighborhoods: toggleInList(d.neighborhoods, n) }))
                    }
                    aria-pressed={draft.neighborhoods?.includes(n)}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                      draft.neighborhoods?.includes(n)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-surface text-muted-foreground",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </FilterField>
          )}

          <FilterField label="Presença digital">
            <div className="grid grid-cols-3 gap-1 rounded-lg border bg-muted/40 p-0.5">
              {(
                [
                  { v: false, l: "Sem site" },
                  { v: true, l: "Com site" },
                  { v: null, l: "Todos" },
                ] as const
              ).map((o) => (
                <button
                  key={String(o.v)}
                  onClick={() => setDraft((d) => ({ ...d, hasWebsite: o.v }))}
                  aria-pressed={
                    draft.hasWebsite === o.v || (o.v === null && draft.hasWebsite == null)
                  }
                  className={cn(
                    "text-xs font-medium rounded-md px-2 py-1.5",
                    draft.hasWebsite === o.v || (o.v === null && draft.hasWebsite == null)
                      ? "bg-surface text-foreground shadow-elegant"
                      : "text-muted-foreground",
                  )}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </FilterField>

          <div className="space-y-2">
            {(
              [
                ["hasPhone", "Possui telefone"],
                ["hasWhatsapp", "Possui WhatsApp"],
                ["hasInstagram", "Possui Instagram"],
                ["hasEmail", "Possui e-mail"],
                ["onlyUncontacted", "Somente leads sem contato"],
                ["onlyWithTask", "Somente leads com próxima tarefa"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={!!draft[key]}
                  onCheckedChange={(v) => setDraft((d) => ({ ...d, [key]: v ? true : undefined }))}
                  aria-label={label}
                />
                {label}
              </label>
            ))}
          </div>

          {savedFilters.length > 0 && (
            <FilterField label="Conjuntos salvos">
              <div className="space-y-1.5">
                {savedFilters.map((sf) => (
                  <div
                    key={sf.id}
                    className="flex items-center gap-2 rounded-md border bg-surface px-2 py-1.5"
                  >
                    <Filter className="h-3 w-3 text-muted-foreground" />
                    <button
                      className="flex-1 text-left text-xs font-medium hover:text-primary"
                      onClick={() => {
                        setDraft(sf.filters);
                        toast.info(`Conjunto "${sf.name}" carregado — aplique para usar`);
                      }}
                    >
                      {sf.name}
                    </button>
                    <button
                      aria-label={`Excluir conjunto ${sf.name}`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => deleteFilterSet(sf.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </FilterField>
          )}

          <FilterField label="Salvar conjunto de filtros">
            <div className="flex gap-1.5">
              <Input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Nome do conjunto"
                className="h-8 text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                disabled={!saveName.trim()}
                onClick={() => {
                  replaceFilters(draft);
                  saveFilterSet(saveName.trim());
                  setSaveName("");
                  toast.success("Conjunto de filtros salvo");
                }}
              >
                <Save className="h-3 w-3" />
                Salvar
              </Button>
            </div>
          </FilterField>
        </div>

        <SheetFooter className="sticky bottom-0 border-t bg-surface/95 backdrop-blur px-4 py-3 flex-col gap-2 sm:flex-col">
          <p className="text-xs text-muted-foreground text-center">
            <b className="text-foreground tabular-nums">{previewCount}</b> leads serão exibidos com
            estes filtros
          </p>
          <div className="flex w-full justify-between gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                clearFilters();
                setDraft({ quick: [] });
                toast.info("Filtros limpos");
              }}
            >
              <X className="mr-1 h-4 w-4" />
              Limpar
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Fechar
              </Button>
              <Button
                onClick={() => {
                  replaceFilters({ ...draft, quick: filters.quick });
                  setOpen(false);
                  toast.success("Filtros aplicados");
                }}
              >
                Aplicar filtros
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
