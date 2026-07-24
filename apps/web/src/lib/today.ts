import type { Lead, LeadActivity } from "@/types";

export type TodayGroupId = "overdue" | "today" | "upcoming" | "first_reach" | "no_next";

export interface TodayItem {
  id: string;
  groupId: TodayGroupId;
  lead: Lead;
  activity?: LeadActivity;
  label: string;
  dueAt?: string;
}

export interface TodayGroup {
  id: TodayGroupId;
  title: string;
  description: string;
  items: TodayItem[];
}

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function buildTodayGroups(pipeline: Lead[]): TodayGroup[] {
  const now = new Date();
  const todayEnd = endOfDay(now);
  const todayStart = startOfDay(now);
  const in7 = new Date(now.getTime() + 7 * 86400000);

  const overdue: TodayItem[] = [];
  const today: TodayItem[] = [];
  const upcoming: TodayItem[] = [];
  const firstReach: TodayItem[] = [];
  const noNext: TodayItem[] = [];

  for (const lead of pipeline) {
    if (lead.stage === "won" || lead.stage === "discarded") continue;

    const openActivities = lead.activities.filter((a) => a.date && !a.done);
    let hasScheduled = false;

    for (const a of openActivities) {
      const due = new Date(a.date!);
      hasScheduled = true;
      const item: TodayItem = {
        id: `${lead.id}:${a.id}`,
        groupId: "today",
        lead,
        activity: a,
        label: a.title,
        dueAt: a.date,
      };
      if (due < todayStart) {
        overdue.push({ ...item, groupId: "overdue" });
      } else if (due <= todayEnd) {
        today.push({ ...item, groupId: "today" });
      } else if (due <= in7) {
        upcoming.push({ ...item, groupId: "upcoming" });
      }
    }

    if (!hasScheduled) {
      if (lead.stage === "new" && !lead.lastInteractionAt) {
        firstReach.push({
          id: `${lead.id}:first`,
          groupId: "first_reach",
          lead,
          label: "Primeira abordagem pendente",
        });
      } else {
        noNext.push({
          id: `${lead.id}:no_next`,
          groupId: "no_next",
          lead,
          label: "Sem próxima ação definida",
        });
      }
    }
  }

  const groups: TodayGroup[] = [
    { id: "overdue", title: "Atrasadas", description: "Atividades vencidas que precisam de ação.", items: overdue },
    { id: "today", title: "Hoje", description: "Programado para hoje.", items: today },
    { id: "first_reach", title: "Primeiras abordagens", description: "Leads novos ainda não contatados.", items: firstReach },
    { id: "upcoming", title: "Próximos 7 dias", description: "Compromissos no radar.", items: upcoming },
    { id: "no_next", title: "Sem próxima ação", description: "Leads ativos parados sem próximo passo.", items: noNext },
  ];

  return groups;
}
