import { buildTodayGroups } from "@/lib/today";
import type { ActivityType, Lead, LeadActivity } from "@/types";

export type CommercialCalendarEvent = {
  id: string;
  source: "activity" | "cadence";
  lead: Lead;
  activity?: LeadActivity;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  done: boolean;
  type: ActivityType | "cadence";
};

const DEFAULT_DURATION_MINUTES = 30;

function validDate(value: string | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function activityStart(date: string, time?: string) {
  const parsed = validDate(date);
  if (!parsed) return null;

  if (time && /^\d{2}:\d{2}$/.test(time)) {
    const [hours, minutes] = time.split(":").map(Number);
    parsed.setHours(hours, minutes, 0, 0);
  }

  return parsed;
}

function activityEnd(activity: LeadActivity, start: Date) {
  const persistedEnd = validDate(activity.scheduledEndAt);
  if (persistedEnd && persistedEnd > start) return persistedEnd;
  return new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60_000);
}

export function buildCommercialCalendarEvents(leads: Lead[]) {
  const events: CommercialCalendarEvent[] = [];

  for (const lead of leads) {
    for (const activity of lead.activities ?? []) {
      const start = activityStart(activity.date, activity.time);
      if (!start) continue;

      events.push({
        id: `${lead.id}:${activity.id}`,
        source: "activity",
        lead,
        activity,
        title: activity.title,
        start,
        end: activityEnd(activity, start),
        allDay: !activity.time,
        done: Boolean(activity.done),
        type: activity.type,
      });
    }
  }

  // Cadence reminders only exist when a lead has no explicit scheduled activity.
  // Excluding TodayItems that already reference an activity prevents duplicates.
  for (const group of buildTodayGroups(leads)) {
    for (const item of group.items) {
      if (item.activity || !item.dueAt) continue;
      const start = validDate(item.dueAt);
      if (!start) continue;
      start.setHours(0, 0, 0, 0);

      events.push({
        id: item.id,
        source: "cadence",
        lead: item.lead,
        title: item.label,
        start,
        end: new Date(start),
        allDay: true,
        done: false,
        type: "cadence",
      });
    }
  }

  return events.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function minutesSinceMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

export function durationMinutes(event: CommercialCalendarEvent) {
  return Math.max(
    DEFAULT_DURATION_MINUTES,
    Math.round((event.end.getTime() - event.start.getTime()) / 60_000),
  );
}
