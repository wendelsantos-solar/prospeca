import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useLeadsList, useCompleteActivityMutation } from "@/hooks/useLeadsQuery";
import { useLeadsStore } from "@/stores";
import { applyFilters } from "@/lib/filters";
import { buildTodayGroups, type TodayItem } from "@/lib/today";
import { ActivityItem } from "@/components/app/ActivityItem";
import { NbaCard } from "@/components/app/NbaCard";
import { SavedFiltersBar } from "@/components/app/SavedFiltersBar";
import { ErrorState } from "@/components/shared/ErrorState";
import { toast } from "sonner";
import { AppIcon } from "@/design-system/icons/AppIcon";
import { icons } from "@/design-system/icons/icon-registry";
import type { Lead, LeadActivity } from "@/types";

export const Route = createFileRoute("/app/hoje")({
  head: () => ({
    meta: [
      { title: "Hoje — Prospeca" },
      {
        name: "description",
        content: "Caixa de entrada comercial: fila de prioridades e agenda de follow-ups.",
      },
    ],
  }),
  component: HojePage,
});

// ── Types ─────────────────────────────────────────────────────────────

type MainTab = "fila" | "agenda";
type AgendaSubTab = "today" | "upcoming" | "overdue" | "completed";

// ── Helpers ───────────────────────────────────────────────────────────

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

// ── Fila tab ──────────────────────────────────────────────────────────

function FilaTab({ leads }: { leads: Lead[] }) {
  const completeMutation = useCompleteActivityMutation();
  const setDetails = useLeadsStore((s) => s.setDetails);
  const [mode, setMode] = useState<"list" | "focus">("list");
  const [focusIdx, setFocusIdx] = useState(0);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());

  const groups = useMemo(() => buildTodayGroups(leads), [leads]);
  const totalPending = groups.reduce((s, g) => s + g.items.length, 0);

  const flatItems: TodayItem[] = useMemo(
    () => groups.flatMap((g) => g.items).filter((it) => !skipped.has(it.id)),
    [groups, skipped],
  );

  function completeFocusItem() {
    const it = flatItems[focusIdx];
    if (!it) return;
    if (it.activity) {
      completeMutation.mutate({ leadId: it.lead.id, activityId: it.activity.id, done: true });
    }
    toast.success("Concluída");
    setFocusIdx((i) => Math.min(i, flatItems.length - 2));
  }

  function skipFocusItem() {
    const it = flatItems[focusIdx];
    if (!it) return;
    setSkipped((s) => new Set(s).add(it.id));
    setFocusIdx((i) => Math.min(i, flatItems.length - 2));
  }

  if (totalPending === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-surface-2 px-5 py-4">
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-card">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-primary-soft text-primary">
            <AppIcon icon={icons.lead.opportunity} size="xl" tone="primary" decorative />
          </div>
          <h2 className="text-[15px] font-semibold">Tudo em dia</h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Nenhuma atividade em aberto. Ótimo momento para prospectar novos leads.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border bg-surface px-5 py-2">
        <div className="flex items-center justify-between">
          <SavedFiltersBar />
          <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-0.5">
            <button
              onClick={() => setMode("list")}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11.5px] font-medium ${
                mode === "list"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <AppIcon icon={icons.layout.list} size="xs" tone="inherit" decorative /> Lista
            </button>
            <button
              onClick={() => {
                setMode("focus");
                setFocusIdx(0);
                setSkipped(new Set());
              }}
              disabled={flatItems.length === 0}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11.5px] font-medium ${
                mode === "focus"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              } disabled:opacity-50`}
            >
              <AppIcon icon={icons.lead.score} size="xs" tone="inherit" decorative /> Foco
            </button>
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-surface-2 px-5 py-4">
        {mode === "list" ? (
          <div className="space-y-6">
            {groups.map((g) =>
              g.items.length === 0 ? null : (
                <section key={g.id}>
                  <div className="mb-2 flex items-center gap-2">
                    <h2 className="text-[13px] font-semibold text-foreground">{g.title}</h2>
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
                      {g.items.length}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{g.description}</span>
                  </div>
                  <div className="space-y-2">
                    {g.items.map((it) =>
                      it.activity ? (
                        <ActivityItem key={it.id} lead={it.lead} activity={it.activity} />
                      ) : (
                        <button
                          key={it.id}
                          onClick={() => setDetails(it.lead.id)}
                          className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 text-left transition-colors hover:border-border-strong"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-semibold text-foreground">
                              {it.lead.companyName}
                            </div>
                            <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                              {it.label}
                            </div>
                          </div>
                          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary-soft text-[11px] font-bold text-primary">
                            {it.lead.score}
                          </div>
                        </button>
                      ),
                    )}
                  </div>
                </section>
              ),
            )}
          </div>
        ) : (
          <FocusMode
            items={flatItems}
            index={focusIdx}
            onPrev={() => setFocusIdx((i) => Math.max(0, i - 1))}
            onNext={() => setFocusIdx((i) => Math.min(flatItems.length - 1, i + 1))}
            onComplete={completeFocusItem}
            onSkip={skipFocusItem}
            onExit={() => setMode("list")}
            onOpenLead={setDetails}
          />
        )}
      </div>
    </div>
  );
}

function FocusMode({
  items,
  index,
  onPrev,
  onNext,
  onComplete,
  onSkip,
  onExit,
  onOpenLead,
}: {
  items: TodayItem[];
  index: number;
  onPrev: () => void;
  onNext: () => void;
  onComplete: () => void;
  onSkip: () => void;
  onExit: () => void;
  onOpenLead: (id: string) => void;
}) {
  const item = items[index];
  if (!item) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-surface p-8 text-center shadow-card">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-primary-soft text-primary">
          <AppIcon icon={icons.feedback.success} size="xl" tone="primary" decorative />
        </div>
        <h2 className="text-[15px] font-semibold">Sessão concluída</h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Você trabalhou todos os itens da caixa. Bom trabalho.
        </p>
        <button
          onClick={onExit}
          className="mt-4 rounded-md bg-primary px-3 py-1.5 text-[12.5px] font-semibold text-primary-foreground hover:bg-primary-hover"
        >
          Voltar à lista
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          {index + 1} de {items.length}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onPrev}
            disabled={index === 0}
            aria-label="Anterior"
            className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted-foreground hover:border-border-strong disabled:opacity-40"
          >
            <AppIcon icon={icons.directional.chevronLeft} size="md" tone="inherit" decorative />
          </button>
          <button
            onClick={onNext}
            disabled={index >= items.length - 1}
            aria-label="Próximo"
            className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted-foreground hover:border-border-strong disabled:opacity-40"
          >
            <AppIcon icon={icons.directional.chevronRight} size="md" tone="inherit" decorative />
          </button>
        </div>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${((index + 1) / items.length) * 100}%` }}
        />
      </div>
      <div className="mt-4 rounded-2xl border border-border bg-surface p-5 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <button
              onClick={() => onOpenLead(item.lead.id)}
              className="text-left text-[16px] font-semibold hover:text-primary"
            >
              {item.lead.companyName}
            </button>
            <div className="mt-0.5 text-[12px] text-muted-foreground">
              {item.lead.category} · {item.lead.neighborhood ?? ""}
              {item.lead.neighborhood ? ", " : ""}
              {item.lead.city}
            </div>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary-soft text-[12px] font-bold text-primary">
            {item.lead.score}
          </div>
        </div>
        <div className="mt-4">
          <NbaCard lead={item.lead} />
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <button
            onClick={onComplete}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12.5px] font-semibold text-primary-foreground hover:bg-primary-hover"
          >
            <AppIcon icon={icons.feedback.success} size="sm" tone="inherit" decorative /> Marcar
            como concluída
          </button>
          <button
            onClick={onSkip}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-[12.5px] font-medium hover:border-border-strong"
          >
            <AppIcon icon={icons.actions.skipForward} size="sm" tone="inherit" decorative /> Pular
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Agenda tab (real activities + synthetic cadence items) ────────────

/** Unified row for the agenda list — either a real user-created activity or
 * a synthetic reminder generated from the cadence engine. */
type AgendaRow =
  | { kind: "real"; lead: Lead; activity: LeadActivity; date: string; done: boolean }
  | { kind: "synthetic"; lead: Lead; label: string; date: string; done: false };

function AgendaTab({ leads }: { leads: Lead[] }) {
  const [subTab, setSubTab] = useState<AgendaSubTab>("today");
  const now = useMemo(() => new Date(), []);

  // ── Build unified rows: real activities + synthetic cadence items ──
  const allRows = useMemo(() => {
    const rows: AgendaRow[] = [];

    // Real activities
    for (const lead of leads) {
      for (const activity of lead.activities ?? []) {
        rows.push({
          kind: "real",
          lead,
          activity,
          date: activity.date ?? "",
          done: !!activity.done,
        });
      }
    }

    // Synthetic items from cadence (same source as the Fila tab)
    const groups = buildTodayGroups(leads);
    for (const g of groups) {
      for (const item of g.items) {
        // Only items with an explicit due date (cadence steps, not
        // first_reach or no_next which have no date to anchor on).
        if (item.dueAt) {
          rows.push({
            kind: "synthetic",
            lead: item.lead,
            label: item.label,
            date: item.dueAt,
            done: false,
          });
        }
      }
    }

    return rows;
  }, [leads]);

  const filtered = useMemo(() => {
    return allRows.filter((row) => {
      if (subTab === "completed") return row.done;
      if (row.done) return false;
      if (!row.date) return false;
      const due = new Date(row.date);
      if (subTab === "overdue") return due < startOfDay(now);
      if (subTab === "today") return due >= startOfDay(now) && due <= endOfDay(now);
      if (subTab === "upcoming") return due > endOfDay(now);
      return false;
    });
  }, [allRows, subTab, now]);

  const counts = useMemo(() => {
    let overdue = 0;
    let today = 0;
    let upcoming = 0;
    let completed = 0;
    for (const row of allRows) {
      if (row.done) {
        completed++;
        continue;
      }
      if (!row.date) continue;
      const due = new Date(row.date);
      if (due < startOfDay(now)) overdue++;
      else if (due <= endOfDay(now)) today++;
      else upcoming++;
    }
    return { overdue, today, upcoming, completed };
  }, [allRows, now]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return list;
  }, [filtered]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 border-b border-border bg-surface px-5 py-2">
        <SubTabBtn
          active={subTab === "today"}
          onClick={() => setSubTab("today")}
          label="Hoje"
          count={counts.today}
        />
        <SubTabBtn
          active={subTab === "upcoming"}
          onClick={() => setSubTab("upcoming")}
          label="Próximas"
          count={counts.upcoming}
        />
        <SubTabBtn
          active={subTab === "overdue"}
          onClick={() => setSubTab("overdue")}
          label="Atrasadas"
          count={counts.overdue}
          tone="danger"
        />
        <SubTabBtn
          active={subTab === "completed"}
          onClick={() => setSubTab("completed")}
          label="Concluídas"
          count={counts.completed}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-surface-2 px-5 py-4">
        {sorted.length === 0 ? (
          <div className="mx-auto mt-8 max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-card">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-primary-soft text-primary">
              <AppIcon icon={icons.feedback.success} size="xl" tone="primary" decorative />
            </div>
            <h2 className="text-[15px] font-semibold">
              {subTab === "overdue"
                ? "Sem atrasos"
                : subTab === "completed"
                  ? "Ainda sem atividades concluídas"
                  : "Nenhuma atividade agendada"}
            </h2>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              {subTab === "completed"
                ? "Marque uma atividade como concluída para vê-la aqui."
                : "Agende retornos e follow-ups a partir do detalhe de um lead."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((row) =>
              row.kind === "real" ? (
                <ActivityItem key={row.activity.id} lead={row.lead} activity={row.activity} />
              ) : (
                <div
                  key={`${row.lead.id}:synth:${row.date}`}
                  className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3"
                >
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
                    <ClockIcon />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-foreground">
                      {row.lead.companyName}
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-muted-foreground">{row.label}</div>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function SubTabBtn({
  active,
  onClick,
  label,
  count,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  tone?: "danger";
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium transition-colors ${
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
      <span
        className={`grid min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-semibold ${
          active
            ? tone === "danger"
              ? "bg-destructive/15 text-destructive"
              : "bg-primary-soft text-primary"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────

function SkeletonList() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg border border-border bg-surface" />
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────

function HojePage() {
  const { data, isLoading, error, refetch } = useLeadsList({ quick: [] });
  const filters = useLeadsStore((s) => s.filters);
  const leads = useMemo(() => applyFilters(data?.items ?? [], filters), [data, filters]);

  const groups = useMemo(() => buildTodayGroups(leads), [leads]);
  const totalPending = groups.reduce((s, g) => s + g.items.length, 0);
  const overdueCount = groups.find((g) => g.id === "overdue")?.items.length ?? 0;

  const [mainTab, setMainTab] = useState<MainTab>("fila");

  if (error && !data) {
    return (
      <div className="grid h-full place-items-center">
        <ErrorState
          title="Falha ao carregar"
          description="Não foi possível carregar seus itens."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-5 py-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary-soft text-primary">
          <AppIcon icon={icons.navigation.today} size="md" tone="primary" decorative />
        </div>
        <div>
          <h1 className="text-[16px] font-semibold">Hoje</h1>
          <p className="text-[11.5px] text-muted-foreground">
            {isLoading ? (
              "Carregando…"
            ) : totalPending === 0 ? (
              "Tudo em dia · nenhum item aberto"
            ) : (
              <>
                {totalPending} {totalPending === 1 ? "item aberto" : "itens abertos"}
                {overdueCount > 0 && (
                  <span className="ml-1 inline-flex items-center gap-1 text-destructive">
                    · <AppIcon icon={icons.feedback.warning} size="xs" tone="inherit" decorative />{" "}
                    {overdueCount} atrasada
                    {overdueCount === 1 ? "" : "s"}
                  </span>
                )}
              </>
            )}
          </p>
        </div>

        {/* Fila / Agenda tabs */}
        <div className="ml-auto flex items-center gap-1 rounded-md border border-border bg-surface p-0.5">
          <button
            onClick={() => setMainTab("fila")}
            className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-[12px] font-medium ${
              mainTab === "fila"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <AppIcon icon={icons.layout.list} size="xs" tone="inherit" decorative /> Fila
          </button>
          <button
            onClick={() => setMainTab("agenda")}
            className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-[12px] font-medium ${
              mainTab === "agenda"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <AppIcon icon={icons.agenda.calendar} size="xs" tone="inherit" decorative /> Agenda
          </button>
        </div>
      </header>

      {isLoading ? (
        <div className="min-h-0 flex-1 overflow-y-auto bg-surface-2 px-5 py-4">
          <SkeletonList />
        </div>
      ) : (
        <>{mainTab === "fila" ? <FilaTab leads={leads} /> : <AgendaTab leads={leads} />}</>
      )}
    </div>
  );
}
