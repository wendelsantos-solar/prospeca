// Notifications — pure domain rules for deriving actionable alerts from the
// funnel. Shared by the web client (demo mode) and the `get-notifications`
// edge function, so both compute the exact same notification keys (the key is
// the stable identity used to persist read/dismissed state server-side).

export type NotificationKind =
  | "overdue_activity"
  | "stalled_lead"
  | "unanswered_proposal"
  | "deal_won"
  | "info";

export interface AppNotification {
  /** Stable key per lead/activity — the identity used for read/dismiss state. */
  id: string;
  kind: NotificationKind;
  title: string;
  description?: string;
  leadId?: string;
  createdAt: string;
}

/** Minimal shape a lead must expose for notification derivation. Both the web
 * `Lead` and the edge function's lead rows map onto this. */
export interface NotificationLeadInput {
  id: string;
  companyName: string;
  stage: string;
  lastInteractionAt?: string | null;
  activities: Array<{
    id: string;
    title?: string;
    date?: string | null;
    done?: boolean;
  }>;
}

const DAY_MS = 86_400_000;

/**
 * Derive actionable notifications from a pipeline snapshot. Deterministic:
 * the same leads always produce the same keys in the same order.
 *
 * - overdue_activity: an open activity whose date has passed.
 * - stalled_lead: a contacted/qualified lead with ≥7 days since last
 *   interaction and no open activity already scheduled.
 */
export function generateNotifications(
  pipeline: NotificationLeadInput[],
  stageLabels: Record<string, string>,
  now: number = Date.now(),
): AppNotification[] {
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

    const lastTs = lead.lastInteractionAt
      ? new Date(lead.lastInteractionAt).getTime()
      : 0;
    const daysSince = lastTs ? Math.floor((now - lastTs) / DAY_MS) : null;

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
        description: `${daysSince} dias sem interação em ${stageLabels[lead.stage] ?? lead.stage}.`,
        leadId: lead.id,
        createdAt: new Date(lastTs).toISOString(),
      });
    }
  }

  return notifs.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 30);
}
