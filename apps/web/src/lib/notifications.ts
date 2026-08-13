import type { Lead } from "@/types";
import { STAGE_LABELS } from "@/lib/constants";
import { generateNotifications as derive } from "@leads/domain";
import type { AppNotification, NotificationKind } from "@leads/domain";

// Re-export the shared types so callers keep the same import surface.
export type { AppNotification, NotificationKind } from "@leads/domain";

/**
 * Thin adapter: maps the web `Lead` shape onto the pure domain
 * `generateNotifications` (packages/domain/src/notifications.ts). The edge
 * function `get-notifications` runs the SAME domain function, so keys and
 * ordering are identical across client and server — required for server-side
 * read/dismiss state to match.
 */
export function generateNotifications(pipeline: Lead[]): AppNotification[] {
  return derive(
    pipeline.map((l) => ({
      id: l.id,
      companyName: l.companyName,
      stage: l.stage,
      lastInteractionAt: l.lastInteractionAt,
      activities: l.activities.map((a) => ({
        id: a.id,
        title: a.title,
        date: a.date,
        done: a.done,
      })),
    })),
    STAGE_LABELS,
  );
}
