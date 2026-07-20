import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragOverEvent,
  useDroppable,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useLeadsStore, useSettingsStore } from "@/stores";
import { useMoveLeadMutation } from "@/hooks/useLeadsQuery";
import type { Lead, LeadStage, LeadTemperature, LeadChannel } from "@/types";
import { STAGE_ORDER, STAGE_LABELS, TEMPERATURE_LABELS } from "@/lib/constants";
import { TemperatureBadge, ScoreBadge } from "@/components/shared/Badges";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatBRL, formatRelative, formatDate, digitsOnly } from "@/lib/format";
import {
  MessageCircle,
  Search,
  MoreHorizontal,
  X,
  ChevronsLeftRight,
  CalendarClock,
  Inbox,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores";

const stageColor: Record<LeadStage, string> = {
  new: "border-t-cold",
  qualified: "border-t-info",
  contacted: "border-t-warm",
  won: "border-t-success",
  discarded: "border-t-destructive",
};

function KanbanCard({
  lead,
  density,
  overlay,
}: {
  lead: Lead;
  density: "compact" | "comfortable";
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    disabled: overlay,
  });
  const setDetails = useLeadsStore((s) => s.setDetails);
  const bulkMode = useLeadsStore((s) => s.bulkMode);
  const selectedIds = useLeadsStore((s) => s.selectedIds);
  const toggleSelect = useLeadsStore((s) => s.toggleSelect);
  const setPendingWin = useLeadsStore((s) => s.setPendingWin);
  const setPendingDiscard = useLeadsStore((s) => s.setPendingDiscard);
  const moveMutation = useMoveLeadMutation();
  const bulkLimit = useSettingsStore((s) => s.bulkLimit);

  const openWhats = (e: React.MouseEvent) => {
    e.stopPropagation();
    const num = digitsOnly(lead.whatsapp ?? lead.phone);
    if (!num) return toast.error("Sem WhatsApp/telefone");
    window.open(`https://wa.me/${num}`, "_blank");
  };

  const style = overlay ? undefined : { transform: CSS.Transform.toString(transform), transition };

  return (
    <Card
      ref={overlay ? undefined : setNodeRef}
      style={style}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      onClick={() => setDetails(lead.id)}
      className={cn(
        "cursor-grab active:cursor-grabbing border-border/70 shadow-elegant hover:border-primary/50 transition-all",
        density === "compact" ? "p-2" : "p-2.5",
        isDragging && "opacity-40",
        overlay && "shadow-elevated rotate-2",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-1.5 min-w-0">
          {bulkMode && (
            <Checkbox
              checked={selectedIds.includes(lead.id)}
              onCheckedChange={() => {
                const r = toggleSelect(lead.id, bulkLimit);
                if (r === "limit") toast.warning(`Limite de ${bulkLimit} selecionados atingido`);
              }}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Selecionar ${lead.companyName}`}
              className="mt-0.5"
            />
          )}
          <div className="min-w-0">
            <p
              className={cn(
                "truncate font-semibold text-foreground",
                density === "compact" ? "text-[12px]" : "text-[13px]",
              )}
            >
              {lead.companyName}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {lead.category} • {lead.neighborhood ?? lead.city}
            </p>
          </div>
        </div>
        <ScoreBadge score={lead.score} />
      </div>
      {density === "comfortable" && (
        <div className="mt-1.5 flex items-center justify-between gap-1">
          <TemperatureBadge temperature={lead.temperature} size="xs" />
          {lead.estimatedValue != null && (
            <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
              {formatBRL(lead.estimatedValue)}
            </span>
          )}
        </div>
      )}
      {density === "comfortable" && lead.nextActivity && (
        <p className="mt-1 flex items-center gap-1 text-[10px] text-info truncate">
          <CalendarClock className="h-3 w-3 shrink-0" />
          {lead.nextActivity.title} — {formatDate(lead.nextActivity.date)}
        </p>
      )}
      {density === "comfortable" && lead.lastInteractionAt && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          {formatRelative(lead.lastInteractionAt)}
        </p>
      )}
      <div className="mt-2 flex items-center justify-between">
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-1.5 text-[11px] gap-1"
          onClick={openWhats}
          aria-label="Abrir WhatsApp"
        >
          <MessageCircle className="h-3 w-3" />
        </Button>
        <span className="text-[9px] uppercase tracking-wide text-muted-foreground/70 tabular-nums">
          {lead.phone ?? ""}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" aria-label="Mais opções">
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {STAGE_ORDER.filter((s) => s !== lead.stage && s !== "won" && s !== "discarded").map(
              (s) => (
                <DropdownMenuItem
                  key={s}
                  onClick={() => {
                    moveMutation.mutate(
                      { id: lead.id, input: { toStage: s } },
                      { onSuccess: () => toast.success(`Movido para ${STAGE_LABELS[s]}`) },
                    );
                  }}
                >
                  Mover para {STAGE_LABELS[s]}
                </DropdownMenuItem>
              ),
            )}
            <DropdownMenuItem onClick={() => setPendingWin(lead.id)}>
              Marcar como Ganho
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setPendingDiscard(lead.id)}
              className="text-destructive focus:text-destructive"
            >
              Descartar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setDetails(lead.id)}>Ver detalhes</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}

function KanbanColumn({
  stage,
  leads,
  density,
}: {
  stage: LeadStage;
  leads: Lead[];
  density: "compact" | "comfortable";
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const collapsedColumns = useUIStore((s) => s.collapsedColumns);
  const toggleColumnCollapsed = useUIStore((s) => s.toggleColumnCollapsed);
  const moveMutation = useMoveLeadMutation();
  const collapsed = collapsedColumns.includes(stage);
  const total = leads.reduce(
    (s, l) => s + (l.stage === "won" ? (l.closedValue ?? 0) : (l.estimatedValue ?? 0)),
    0,
  );

  if (collapsed) {
    return (
      <button
        onClick={() => toggleColumnCollapsed(stage)}
        className={cn(
          "flex h-full w-10 shrink-0 flex-col items-center gap-2 rounded-lg border bg-surface py-3 border-t-2 hover:bg-accent transition-colors",
          stageColor[stage],
        )}
        aria-label={`Expandir coluna ${STAGE_LABELS[stage]}`}
      >
        <ChevronsLeftRight className="h-3.5 w-3.5 text-muted-foreground" />
        <span
          className="text-[11px] font-semibold text-foreground"
          style={{ writingMode: "vertical-rl" }}
        >
          {STAGE_LABELS[stage]} ({leads.length})
        </span>
      </button>
    );
  }

  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div
        className={cn(
          "flex items-center justify-between gap-2 rounded-t-lg border border-b-0 bg-surface px-3 py-2 border-t-2",
          stageColor[stage],
        )}
      >
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground">{STAGE_LABELS[stage]}</p>
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {leads.length} leads • {formatBRL(total)}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              aria-label={`Ações da coluna ${STAGE_LABELS[stage]}`}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => toggleColumnCollapsed(stage)}>
              Recolher coluna
            </DropdownMenuItem>
            {stage === "new" && leads.length > 0 && (
              <DropdownMenuItem
                onClick={() => {
                  leads.forEach((l) =>
                    moveMutation.mutate({ id: l.id, input: { toStage: "qualified" } }),
                  );
                  toast.success(`${leads.length} leads qualificados`);
                }}
              >
                Qualificar todos ({leads.length})
              </DropdownMenuItem>
            )}
            {stage === "qualified" && leads.length > 0 && (
              <DropdownMenuItem
                onClick={() => {
                  leads.forEach((l) =>
                    moveMutation.mutate({ id: l.id, input: { toStage: "contacted" } }),
                  );
                  toast.success(`${leads.length} leads marcados como contatados`);
                }}
              >
                Marcar todos como contatados
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 min-h-[300px] space-y-2 rounded-b-lg border bg-muted/30 p-2 overflow-y-auto",
          isOver && "bg-primary/5 ring-1 ring-primary/40",
        )}
      >
        <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          {leads.length === 0 ? (
            <div className="grid h-24 place-items-center text-[11px] text-muted-foreground/70">
              <div className="flex flex-col items-center gap-1">
                <Inbox className="h-4 w-4" />
                Arraste leads aqui
              </div>
            </div>
          ) : (
            leads.map((l) => <KanbanCard key={l.id} lead={l} density={density} />)
          )}
        </SortableContext>
      </div>
    </div>
  );
}

export function KanbanBoard({
  leads,
  density,
}: {
  leads: Lead[];
  density: "compact" | "comfortable";
}) {
  const moveMutation = useMoveLeadMutation();
  const setPendingWin = useLeadsStore((s) => s.setPendingWin);
  const setPendingDiscard = useLeadsStore((s) => s.setPendingDiscard);
  const kanbanOrder = useLeadsStore((s) => s.kanbanOrder);
  const reorderInColumn = useLeadsStore((s) => s.reorderInColumn);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map: Record<LeadStage, Lead[]> = {
      new: [],
      qualified: [],
      contacted: [],
      won: [],
      discarded: [],
    };
    leads.forEach((l) => map[l.stage].push(l));
    (Object.keys(map) as LeadStage[]).forEach((k) => {
      map[k].sort((a, b) => (kanbanOrder[a.id] ?? 999) - (kanbanOrder[b.id] ?? 999));
    });
    return map;
  }, [leads, kanbanOrder]);

  const findStage = (id: string): LeadStage | undefined => {
    if (STAGE_ORDER.includes(id as LeadStage)) return id as LeadStage;
    return leads.find((l) => l.id === id)?.stage;
  };

  const onDragOver = (_e: DragOverEvent) => {
    /* placeholder visual handled by dnd-kit sortable transform */
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const activeLeadId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;
    const lead = leads.find((l) => l.id === activeLeadId);
    if (!lead) return;
    const targetStage = findStage(overId);
    if (!targetStage) return;

    if (targetStage === lead.stage) {
      // Reordenação dentro da coluna
      if (overId !== activeLeadId && !STAGE_ORDER.includes(overId as LeadStage)) {
        const ids = grouped[lead.stage].map((l) => l.id);
        const from = ids.indexOf(activeLeadId);
        const to = ids.indexOf(overId);
        if (from >= 0 && to >= 0) reorderInColumn(lead.stage, arrayMove(ids, from, to));
      }
      return;
    }
    if (targetStage === "won") {
      setPendingWin(lead.id);
      return;
    }
    if (targetStage === "discarded") {
      setPendingDiscard(lead.id);
      return;
    }
    moveMutation.mutate(
      { id: lead.id, input: { toStage: targetStage } },
      { onSuccess: () => toast.success(`Movido para ${STAGE_LABELS[targetStage]}`) },
    );
  };

  const activeLead = leads.find((l) => l.id === activeId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex h-full gap-3 overflow-x-auto p-4">
        {STAGE_ORDER.map((s) => (
          <KanbanColumn key={s} stage={s} leads={grouped[s]} density={density} />
        ))}
      </div>
      <DragOverlay>
        {activeLead ? <KanbanCard lead={activeLead} density={density} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

const CHANNEL_OPTIONS: { value: LeadChannel; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "phone", label: "Telefone" },
  { value: "instagram", label: "Instagram" },
  { value: "email", label: "E-mail" },
  { value: "website", label: "Site" },
];

export interface KanbanFilters {
  temperature: LeadTemperature | "all";
  city: string;
  category: string;
  stage: LeadStage | "all";
  channel: LeadChannel | "all";
}

export const EMPTY_KANBAN_FILTERS: KanbanFilters = {
  temperature: "all",
  city: "all",
  category: "all",
  stage: "all",
  channel: "all",
};

export function applyKanbanFilters(leads: Lead[], f: KanbanFilters): Lead[] {
  return leads.filter((l) => {
    if (f.temperature !== "all" && l.temperature !== f.temperature) return false;
    if (f.city !== "all" && l.city !== f.city) return false;
    if (f.category !== "all" && l.category !== f.category) return false;
    if (f.stage !== "all" && l.stage !== f.stage) return false;
    if (f.channel !== "all") {
      if (f.channel === "whatsapp" && !l.whatsapp) return false;
      if (f.channel === "phone" && !l.phone) return false;
      if (f.channel === "instagram" && !l.instagram) return false;
      if (f.channel === "email" && !l.email) return false;
      if (f.channel === "website" && !l.hasWebsite) return false;
    }
    return true;
  });
}

export function KanbanTopBar({
  search,
  setSearch,
  density,
  setDensity,
  count,
  selected,
  onPrepareMessages,
  filters,
  setFilters,
  cities,
  categories,
}: {
  search: string;
  setSearch: (v: string) => void;
  density: "compact" | "comfortable";
  setDensity: (d: "compact" | "comfortable") => void;
  count: number;
  selected: number;
  onPrepareMessages: () => void;
  filters: KanbanFilters;
  setFilters: (f: KanbanFilters) => void;
  cities: string[];
  categories: string[];
}) {
  const hasFilters =
    filters.temperature !== "all" ||
    filters.city !== "all" ||
    filters.category !== "all" ||
    filters.stage !== "all" ||
    filters.channel !== "all";
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-surface/95 px-4 py-2.5 backdrop-blur">
      <span className="text-xs text-muted-foreground">
        <b className="text-foreground">{count}</b> leads
      </span>
      {selected > 0 && (
        <span className="text-xs text-muted-foreground">
          • <b className="text-primary">{selected}</b> selecionados
        </span>
      )}
      <div className="relative ml-2 flex-1 min-w-[140px] max-w-xs">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome..."
          className="h-8 pl-7 text-xs"
          aria-label="Buscar leads por nome"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Limpar busca"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <Select
        value={filters.temperature}
        onValueChange={(v) =>
          setFilters({ ...filters, temperature: v as KanbanFilters["temperature"] })
        }
      >
        <SelectTrigger className="h-8 w-[110px] text-xs" aria-label="Filtrar por temperatura">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-xs">
            Temperatura
          </SelectItem>
          {(Object.keys(TEMPERATURE_LABELS) as LeadTemperature[]).map((t) => (
            <SelectItem key={t} value={t} className="text-xs">
              {TEMPERATURE_LABELS[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filters.city} onValueChange={(v) => setFilters({ ...filters, city: v })}>
        <SelectTrigger
          className="h-8 w-[130px] text-xs hidden lg:flex"
          aria-label="Filtrar por cidade"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-xs">
            Cidade
          </SelectItem>
          {cities.map((c) => (
            <SelectItem key={c} value={c} className="text-xs">
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={filters.category}
        onValueChange={(v) => setFilters({ ...filters, category: v })}
      >
        <SelectTrigger
          className="h-8 w-[140px] text-xs hidden xl:flex"
          aria-label="Filtrar por categoria"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-xs">
            Categoria
          </SelectItem>
          {categories.map((c) => (
            <SelectItem key={c} value={c} className="text-xs">
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={filters.stage}
        onValueChange={(v) => setFilters({ ...filters, stage: v as KanbanFilters["stage"] })}
      >
        <SelectTrigger
          className="h-8 w-[120px] text-xs hidden xl:flex"
          aria-label="Filtrar por estágio"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-xs">
            Estágio
          </SelectItem>
          {STAGE_ORDER.map((s) => (
            <SelectItem key={s} value={s} className="text-xs">
              {STAGE_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={filters.channel}
        onValueChange={(v) => setFilters({ ...filters, channel: v as KanbanFilters["channel"] })}
      >
        <SelectTrigger
          className="h-8 w-[120px] text-xs hidden lg:flex"
          aria-label="Filtrar por canal"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-xs">
            Canal
          </SelectItem>
          {CHANNEL_OPTIONS.map((c) => (
            <SelectItem key={c.value} value={c.value} className="text-xs">
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hasFilters && (
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs gap-1"
          onClick={() => setFilters(EMPTY_KANBAN_FILTERS)}
        >
          <X className="h-3 w-3" />
          Limpar
        </Button>
      )}

      <div className="ml-auto flex items-center gap-2">
        <div
          className="hidden sm:flex items-center gap-1 rounded-md border bg-muted/40 p-0.5"
          role="group"
          aria-label="Densidade dos cards"
        >
          {(["compact", "comfortable"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDensity(d)}
              aria-pressed={density === d}
              className={cn(
                "rounded px-2 py-1 text-[10px] font-medium",
                density === d
                  ? "bg-surface text-foreground shadow-elegant"
                  : "text-muted-foreground",
              )}
            >
              {d === "compact" ? "Compacto" : "Confortável"}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          onClick={onPrepareMessages}
          disabled={selected === 0}
          className="h-8 gap-1.5 text-xs"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Preparar mensagens
        </Button>
      </div>
    </div>
  );
}
