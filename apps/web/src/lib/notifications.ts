import type { Lead } from "@/types";

export type NotificationKind =
  | "overdue_activity"
  | "stalled_lead"
  | "unanswered_proposal"
  | "deal_won"
  | "info";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  description?: string;
  leadId?: string;
  createdAt: string;
  readAt?: string;
}

export function generateNotifications(pipeline: Lead[]): AppNotification[] {
  const now = Date.now();
  const notifs: AppNotification[] = [];

  for (const lead of pipeline) {
    if (lead.stage === "won" || lead.stage === "discarded") continue;

    const overdueActivity = lead.activities.find(
      (a) => a.date && !a.done && new Date(a.date).getTime() < now,
    );
    if (overdueActivity) {
      notifs.push({
        id: `gen-overdue-${lead.id}-${overdueActivity.id}`,
        kind: "overdue_activity",
        title: `Atividade atrasada — ${lead.companyName}`,
        description: overdueActivity.title,
        leadId: lead.id,
        createdAt: overdueActivity.date!,
      });
    }

    const lastTs = lead.lastInteractionAt ? new Date(lead.lastInteractionAt).getTime() : 0;
    const daysSince = lastTs ? Math.floor((now - lastTs) / 86400000) : null;

    if (
      (lead.stage === "contacted" || lead.stage === "qualified") &&
      daysSince !== null &&
      daysSince >= 7 &&
      !lead.activities.some((a) => a.date && !a.done)
    ) {
      notifs.push({
        id: `gen-stalled-${lead.id}`,
        kind: "stalled_lead",
        title: `Lead parado — ${lead.companyName}`,
        description: `${daysSince} dias sem interação em ${lead.stage}.`,
        leadId: lead.id,
        createdAt: new Date(lastTs).toISOString(),
      });
    }
  }

  return notifs.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 30);
}
