import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays, CheckCircle2 } from "lucide-react";
import { useLeadsList } from "@/hooks/useLeadsQuery";
import { ActivityItem } from "@/components/app/ActivityItem";
import type { Lead, LeadActivity } from "@/types";

export const Route = createFileRoute("/app/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — Radar Local" },
      {
        name: "description",
        content:
          "Veja atividades atrasadas, do dia e dos próximos 7 dias em uma agenda comercial clara e acionável.",
      },
    ],
  }),
  component: AgendaPage,
});

type Tab = "today" | "upcoming" | "overdue" | "completed";
type Row = { lead: Lead; activity: LeadActivity };

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

function AgendaPage() {
  const { data, isLoading } = useLeadsList({ quick: [] });
  const leads = useMemo(() => data?.items ?? [], [data]);
  const [tab, setTab] = useState<Tab>("today");

  const rows = useMemo(() => {
    const all: Row[] = [];
    for (const lead of leads) {
      for (const activity of lead.activities ?? []) {
        all.push({ lead, activity });
      }
    }
    return all;
  }, [leads]);

  const now = useMemo(() => new Date(), []);
  const filtered = useMemo(() => {
    return rows.filter(({ activity }) => {
      if (tab === "completed") return !!activity.done;
      if (activity.done) return false;
      const due = new Date(activity.date);
      if (tab === "overdue") return due < startOfDay(now);
      if (tab === "today") return due >= startOfDay(now) && due <= endOfDay(now);
      if (tab === "upcoming") return due > endOfDay(now);
      return false;
    });
  }, [rows, tab, now]);

  const counts = useMemo(() => {
    let overdue = 0;
    let today = 0;
    let upcoming = 0;
    let completed = 0;
    for (const { activity } of rows) {
      if (activity.done) {
        completed++;
        continue;
      }
      const due = new Date(activity.date);
      if (due < startOfDay(now)) overdue++;
      else if (due <= endOfDay(now)) today++;
      else upcoming++;
    }
    return { overdue, today, upcoming, completed };
  }, [rows, now]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    if (tab === "completed") {
      list.sort((a, b) => {
        const aKey = new Date(a.activity.completedAt ?? a.activity.date).getTime();
        const bKey = new Date(b.activity.completedAt ?? b.activity.date).getTime();
        return bKey - aKey;
      });
    } else {
      list.sort(
        (a, b) => new Date(a.activity.date).getTime() - new Date(b.activity.date).getTime(),
      );
    }
    return list;
  }, [filtered, tab]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-5 py-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary-soft text-primary">
          <CalendarDays className="h-4 w-4" />
        </div>
        <div>
          <h1 className="text-[16px] font-semibold">Agenda</h1>
          <p className="text-[11.5px] text-muted-foreground">
            {isLoading
              ? "Carregando…"
              : `${counts.overdue + counts.today + counts.upcoming} ativas · ${counts.completed} concluídas`}
          </p>
        </div>
      </header>

      <div className="flex items-center gap-1 border-b border-border bg-surface px-5 py-2">
        <TabBtn
          active={tab === "today"}
          onClick={() => setTab("today")}
          label="Hoje"
          count={counts.today}
        />
        <TabBtn
          active={tab === "upcoming"}
          onClick={() => setTab("upcoming")}
          label="Próximas"
          count={counts.upcoming}
        />
        <TabBtn
          active={tab === "overdue"}
          onClick={() => setTab("overdue")}
          label="Atrasadas"
          count={counts.overdue}
          tone="danger"
        />
        <TabBtn
          active={tab === "completed"}
          onClick={() => setTab("completed")}
          label="Concluídas"
          count={counts.completed}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-surface-2 px-5 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-lg border border-border bg-surface"
              />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="mx-auto mt-8 max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-card">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-primary-soft text-primary">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <h2 className="text-[15px] font-semibold">
              {tab === "overdue"
                ? "Sem atrasos"
                : tab === "completed"
                  ? "Ainda sem atividades concluídas"
                  : "Nenhuma atividade agendada"}
            </h2>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              {tab === "completed"
                ? "Marque uma atividade como concluída para vê-la aqui."
                : "Agende retornos e follow-ups a partir do detalhe de um lead."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map(({ lead, activity }) => (
              <ActivityItem key={activity.id} lead={lead} activity={activity} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn({
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
