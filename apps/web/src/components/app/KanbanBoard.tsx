import { memo, useMemo, useState } from "react";
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
import { useMoveLeadMutation, useRemoveLeadMutation } from "@/hooks/useLeadsQuery";
import { pushRecentAction } from "@/lib/recent-actions";
import type { Lead, LeadStage, LeadTemperature, LeadChannel } from "@/types";
import { STAGE_ORDER, STAGE_LABELS, TEMPERATURE_LABELS } from "@/lib/constants";
import { TemperatureBadge, ScoreBadge } from "@/components/shared/Badges";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatBRL, formatRelative, formatDate } from "@/lib/format";
import { useOutbound } from "@/hooks/useOutbound";
import {
  MessageCircle,
  Search,
  MoreHorizontal,
  X,
  ChevronsLeftRight,
  CalendarClock,
  Inbox,
  Navigation,
  ListChecks,
  GripVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { categoryLabel } from "@/lib/category";
import { useUIStore } from "@/stores";

// Tokens dedicados por estágio (styles.css) — antes emprestavam de
// hot/warm/info/destructive sem relação semântica com o Pipeline.
const stageColor: Record<LeadStage, string> = {
  new: "border-t-stage-new",
  qualified: "border-t-stage-qualified",
  contacted: "border-t-stage-contacted",
  won: "border-t-stage-won",
  discarded: "border-t-stage-discarded",
};

const stageDot: Record<LeadStage, string> = {
  new: "bg-stage-new",
  qualified: "bg-stage-qualified",
  contacted: "bg-stage-contacted",
  won: "bg-stage-won",
  discarded: "bg-stage-discarded",
};

const KanbanCard = memo(function KanbanCard({
  lead,
  density,
  overlay,
  membersById,
}: {
  lead: Lead;
  density: "compact" | "comfortable";
  overlay?: boolean;
  /** userId → nome de exibição (membros da org) — chip de responsável. */
  membersById?: Map<string, string>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    disabled: overlay,
  });
  const setDetails = useLeadsStore((s) => s.setDetails);
  const bulkMode = useLeadsStore((s) => s.bulkMode);
  const isSelected = useLeadsStore((s) => s.selectedIds.includes(lead.id));
  const toggleSelect = useLeadsStore((s) => s.toggleSelect);
  const setPendingWin = useLeadsStore((s) => s.setPendingWin);
  const setPendingDiscard = useLeadsStore((s) => s.setPendingDiscard);
  const moveMutation = useMoveLeadMutation();
  const removeLeadMut = useRemoveLeadMutation();
  const bulkLimit = useSettingsStore((s) => s.bulkLimit);
  const { openWhatsApp } = useOutbound();
  const [confirmRemove, setConfirmRemove] = useState(false);

  const openWhats = (e: React.MouseEvent) => {
    e.stopPropagation();
    void openWhatsApp(lead);
  };

  const style = overlay ? undefined : { transform: CSS.Transform.toString(transform), transition };

  return (
    <Card
      ref={overlay ? undefined : setNodeRef}
      style={style}
      className={cn(
        "group border-border/70 shadow-none transition-all hover:border-border-strong hover:shadow-card",
        density === "compact" ? "p-2" : "p-2.5",
        isDragging && "opacity-40",
        overlay && "shadow-elevated rotate-2",
      )}
    >
      <div className="flex items-start gap-1.5">
        {bulkMode && !overlay && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => {
              const result = toggleSelect(lead.id, bulkLimit);
              if (result === "limit") {
                toast.warning(`Limite de ${bulkLimit} selecionados atingido`);
              }
            }}
            aria-label={`Selecionar ${lead.companyName}`}
            className="mt-0.5"
          />
        )}
        <button
          type="button"
          onClick={() => setDetails(lead.id)}
          disabled={overlay}
          className="min-w-0 flex-1 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={`Ver detalhes de ${lead.companyName}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p
                className={cn(
                  "truncate font-semibold text-foreground",
                  density === "compact" ? "text-[12px]" : "text-[13px]",
                )}
              >
                {lead.companyName}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">
                {categoryLabel(lead.category)} • {lead.neighborhood ?? lead.city}
              </p>
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
          {lead.assignedTo && membersById?.get(lead.assignedTo) && (
            <p className="mt-1 flex items-center gap-1 truncate text-[10px] text-muted-foreground">
              <span className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-primary/15 text-[8px] font-semibold text-primary">
                {membersById.get(lead.assignedTo)!.slice(0, 1).toUpperCase()}
              </span>
              {membersById.get(lead.assignedTo)}
            </p>
          )}
          {density === "comfortable" && lead.nextActivity && (
            <p className="mt-1 flex items-center gap-1 truncate text-[10px] text-info">
              <CalendarClock className="h-3 w-3 shrink-0" />
              {lead.nextActivity.title} — {formatDate(lead.nextActivity.date)}
            </p>
          )}
          {density === "comfortable" && lead.lastInteractionAt && (
            <p className="mt-1 text-[10px] text-muted-foreground">
              {formatRelative(lead.lastInteractionAt)}
            </p>
          )}
        </button>
      </div>
      {!overlay && (
        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="grid h-6 w-6 shrink-0 cursor-grab place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
            aria-label={`Arrastar ${lead.companyName}`}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 gap-1 px-1.5 text-[11px] opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            onClick={openWhats}
            aria-label="Abrir WhatsApp"
          >
            <MessageCircle className="h-3 w-3" />
          </Button>
          <span className="text-[9px] uppercase tracking-wide text-muted-foreground/70 tabular-nums opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            {lead.phone ?? ""}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" aria-label="Mais opções">
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {STAGE_ORDER.filter(
                (stage) => stage !== lead.stage && stage !== "won" && stage !== "discarded",
              ).map((stage) => (
                <DropdownMenuItem
                  key={stage}
                  onClick={() => {
                    moveMutation.mutate(
                      { id: lead.id, input: { toStage: stage } },
                      {
                        onSuccess: () => {
                          pushRecentAction(`Lead movido para ${STAGE_LABELS[stage]}`);
                          toast.success(`Movido para ${STAGE_LABELS[stage]}`);
                        },
                      },
                    );
                  }}
                >
                  Mover para {STAGE_LABELS[stage]}
                </DropdownMenuItem>
              ))}
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
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setConfirmRemove(true)}
              >
                Remover lead
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Dialog open={confirmRemove} onOpenChange={setConfirmRemove}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Remover {lead.companyName}?</DialogTitle>
                <DialogDescription>
                  Apaga o lead e seu histórico (notas, atividades) permanentemente — diferente de
                  "Descartar", que só marca o estágio e mantém tudo. Não pode ser desfeito.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmRemove(false)}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  disabled={removeLeadMut.isPending}
                  onClick={() => {
                    removeLeadMut.mutate(lead.id, {
                      onSuccess: () => {
                        pushRecentAction(`${lead.companyName} removido do pipeline`);
                        toast.success("Lead removido do pipeline");
                        setConfirmRemove(false);
                      },
                      onError: () => toast.error("Falha ao remover o lead"),
                    });
                  }}
                >
                  {removeLeadMut.isPending ? "Removendo..." : "Remover permanentemente"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </Card>
  );
});

function KanbanColumn({
  stage,
  leads,
  density,
  serverCount,
  membersById,
}: {
  stage: LeadStage;
  leads: Lead[];
  density: "compact" | "comfortable";
  /** Total REAL do estágio vindo do servidor (COUNT) — nunca do array carregado. */
  serverCount: number;
  membersById?: Map<string, string>;
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
          {STAGE_LABELS[stage]} ({serverCount})
        </span>
      </button>
    );
  }

  return (
    <div
      data-testid={`kanban-column-${stage}`}
      className="flex w-[calc(100vw-1.5rem)] shrink-0 snap-start flex-col md:w-72"
    >
      <div
        className={cn(
          "flex items-center justify-between gap-2 rounded-t-lg border border-b-0 bg-surface px-3 py-2 border-t-2",
          stageColor[stage],
        )}
      >
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <span
              className={cn("h-1.5 w-1.5 shrink-0 rounded-full", stageDot[stage])}
              aria-hidden
            />
            {STAGE_LABELS[stage]}
          </p>
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {serverCount} leads
            {leads.length < serverCount ? ` • ${leads.length} carregados` : ""} • {formatBRL(total)}
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
            <div className="grid h-28 place-items-center px-3 text-center">
              <div className="flex flex-col items-center gap-1.5">
                <Inbox className="h-4 w-4 text-muted-foreground/70" />
                <p className="text-[11px] font-medium text-foreground">Nenhum lead neste estágio</p>
                <p className="text-[10.5px] text-muted-foreground">
                  Arraste um card ou adicione um lead ao Pipeline.
                </p>
              </div>
            </div>
          ) : (
            leads.map((l) => (
              <KanbanCard key={l.id} lead={l} density={density} membersById={membersById} />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}

export function KanbanBoard({
  leads,
  density,
  stageCounts,
  membersById,
  hasMore,
  onLoadMore,
}: {
  leads: Lead[];
  density: "compact" | "comfortable";
  /** Totais por estágio do servidor (COUNT) — visíveis mesmo antes de carregar tudo. */
  stageCounts?: { total: number; byStage: Record<string, number> };
  membersById?: Map<string, string>;
  hasMore?: boolean;
  onLoadMore?: () => void;
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
      {/* w-fit + mx-auto centers the columns when they fit the viewport;
       * once they don't, w-fit keeps the row exactly content-width so the
       * outer overflow-x-auto scrolls normally instead of clipping (which
       * `justify-center` on the scroll container itself would do). */}
      <div className="h-full snap-x snap-mandatory overflow-x-auto p-2 md:snap-none md:p-4">
        <div className="mx-auto flex h-full w-fit gap-2 md:gap-3">
          {STAGE_ORDER.map((s) => (
            <KanbanColumn
              key={s}
              stage={s}
              leads={grouped[s]}
              density={density}
              serverCount={stageCounts?.byStage[s] ?? grouped[s].length}
              membersById={membersById}
            />
          ))}
        </div>
      </div>
      {hasMore && (
        <div className="flex justify-center border-t bg-surface p-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            className="text-xs"
            aria-label="Carregar mais leads"
          >
            Carregar mais leads
          </Button>
        </div>
      )}
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
  assignee: string | "all";
}

export const EMPTY_KANBAN_FILTERS: KanbanFilters = {
  temperature: "all",
  city: "all",
  category: "all",
  stage: "all",
  channel: "all",
  assignee: "all",
};

export function applyKanbanFilters(leads: Lead[], f: KanbanFilters): Lead[] {
  return leads.filter((l) => {
    if (f.temperature !== "all" && l.temperature !== f.temperature) return false;
    if (f.city !== "all" && l.city !== f.city) return false;
    if (f.category !== "all" && l.category !== f.category) return false;
    if (f.stage !== "all" && l.stage !== f.stage) return false;
    if (f.assignee !== "all" && l.assignedTo !== f.assignee) return false;
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
  bulkMode,
  onToggleBulkMode,
  onPrepareMessages,
  onPlanRoute,
  filters,
  setFilters,
  cities,
  categories,
  members,
  loadedCount,
  onExport,
  exporting,
}: {
  search: string;
  setSearch: (v: string) => void;
  density: "compact" | "comfortable";
  setDensity: (d: "compact" | "comfortable") => void;
  /** Total REAL da carteira (servidor). `loadedCount` é o que está em memória. */
  count: number;
  loadedCount: number;
  selected: number;
  bulkMode: boolean;
  onToggleBulkMode: () => void;
  onPrepareMessages: () => void;
  onPlanRoute: () => void;
  filters: KanbanFilters;
  setFilters: (f: KanbanFilters) => void;
  cities: string[];
  categories: string[];
  members: { userId: string; fullName: string | null }[];
  onExport: (format: "csv" | "xlsx") => void;
  exporting: boolean;
}) {
  const hasFilters =
    filters.temperature !== "all" ||
    filters.city !== "all" ||
    filters.category !== "all" ||
    filters.stage !== "all" ||
    filters.channel !== "all" ||
    filters.assignee !== "all";
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-surface/95 px-4 py-2.5 backdrop-blur">
      <span className="text-xs text-muted-foreground">
        {loadedCount < count ? (
          <>
            <b className="text-foreground">{loadedCount}</b> de{" "}
            <b className="text-foreground">{count}</b> leads carregados
          </>
        ) : (
          <>
            <b className="text-foreground">{count}</b> leads
          </>
        )}
      </span>
      {selected > 0 && (
        <span className="text-xs text-muted-foreground">
          • <b className="text-primary">{selected}</b> selecionados
        </span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" disabled={exporting}>
            {exporting ? "Exportando..." : "Exportar"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => onExport("csv")}>
            Exportar CSV (o que estou vendo)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExport("xlsx")}>
            Exportar XLSX (o que estou vendo)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="relative order-first w-full min-w-[140px] sm:order-none sm:ml-2 sm:max-w-xs sm:flex-1">
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
        <SelectTrigger className="h-8 w-[132px] text-xs" aria-label="Filtrar por temperatura">
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
              {categoryLabel(c)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={filters.assignee}
        onValueChange={(v) => setFilters({ ...filters, assignee: v as KanbanFilters["assignee"] })}
      >
        <SelectTrigger className="h-8 w-[140px] text-xs" aria-label="Filtrar por responsável">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-xs">
            Responsável
          </SelectItem>
          {members.map((m) => (
            <SelectItem key={m.userId} value={m.userId} className="text-xs">
              {m.fullName ?? m.userId.slice(0, 8)}
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
                density === d ? "bg-surface text-foreground shadow-card" : "text-muted-foreground",
              )}
            >
              {d === "compact" ? "Compacto" : "Confortável"}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          variant={bulkMode ? "secondary" : "outline"}
          onClick={onToggleBulkMode}
          className="h-8 gap-1.5 text-xs"
          aria-label={bulkMode ? "Cancelar seleção" : "Selecionar"}
          title={bulkMode ? "Cancelar seleção" : "Selecionar"}
        >
          <ListChecks className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">{bulkMode ? "Cancelar seleção" : "Selecionar"}</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onPlanRoute}
          disabled={selected === 0}
          className="h-8 gap-1.5 text-xs"
          aria-label="Planejar rota"
          title="Planejar rota"
        >
          <Navigation className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Planejar rota</span>
        </Button>
        <Button
          size="sm"
          onClick={onPrepareMessages}
          disabled={selected === 0}
          className="h-8 gap-1.5 text-xs"
          aria-label="Preparar mensagens"
          title="Preparar mensagens"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Preparar mensagens</span>
        </Button>
      </div>
    </div>
  );
}
