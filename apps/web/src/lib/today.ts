import type { Lead, LeadActivity } from "@/types";
import { CADENCE_STEPS, currentCadenceStep, nextCadenceStep, cadenceStepDueDate } from "./cadence";

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

/**
 * The concrete "what do I do now" for a lead that has no scheduled activity
 * and no automatic cadence tick. Replaces the old catch-all "Sem próxima ação
 * definida" — which was misleading for leads that DO have an obvious next step.
 */
function stuckLabel(lead: Lead): string {
  if (
    lead.stage === "contacted" &&
    (lead.cadenceCompletedAt || (lead.cadenceStep ?? 0) >= CADENCE_STEPS.length)
  ) {
    return "Cadência concluída — definir próximo passo";
  }
  if (lead.stage === "contacted" && !lead.cadenceStartedAt) {
    return "Confirmar primeiro contato";
  }
  if (lead.stage === "qualified") {
    return "Qualificado — agendar próximo passo";
  }
  return "Sem próxima ação definida";
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
      } else if (lead.stage === "contacted" && lead.cadenceStartedAt) {
        // No activity was explicitly scheduled, but a contacted lead always
        // has a cadence step ticking after a confirmed first contact (see
        // lib/cadence.ts) — surface it instead of using card movement as
        // evidence that a customer interaction happened.
        const due = currentCadenceStep(lead);
        const step = due ?? nextCadenceStep(lead);
        const dueDate = step ? cadenceStepDueDate(lead, step) : null;
        if (step && dueDate) {
          const item: TodayItem = {
            id: `${lead.id}:cadence:${step.id}`,
            groupId: "today",
            lead,
            label: `Cadência: ${step.label}`,
            dueAt: dueDate,
          };
          const dueTime = new Date(dueDate);
          if (dueTime < todayStart) {
            overdue.push({ ...item, groupId: "overdue" });
          } else if (dueTime <= todayEnd) {
            today.push({ ...item, groupId: "today" });
          } else {
            // A future cadence step (even beyond 7 days) still HAS a next
            // action — keep the step label and surface it as upcoming, rather
            // than losing it under a misleading "no next action" bucket.
            upcoming.push({ ...item, groupId: "upcoming" });
          }
        } else {
          noNext.push({
            id: `${lead.id}:no_next`,
            groupId: "no_next",
            lead,
            label: stuckLabel(lead),
          });
        }
      } else {
        noNext.push({
          id: `${lead.id}:no_next`,
          groupId: "no_next",
          lead,
          label: stuckLabel(lead),
        });
      }
    }
  }

  const groups: TodayGroup[] = [
    {
      id: "overdue",
      title: "Atrasadas",
      description: "Atividades vencidas que precisam de ação.",
      items: overdue,
    },
    { id: "today", title: "Hoje", description: "Programado para hoje.", items: today },
    {
      id: "first_reach",
      title: "Primeiras abordagens",
      description: "Leads novos ainda não contatados.",
      items: firstReach,
    },
    {
      id: "upcoming",
      title: "Próximos dias",
      description: "Compromissos e cadências futuras no radar.",
      items: upcoming,
    },
    {
      id: "no_next",
      title: "Precisa de decisão",
      description: "Leads ativos esperando seu próximo passo.",
      items: noNext,
    },
  ];

  return groups;
}
