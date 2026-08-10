import { describe, expect, test } from "bun:test";
import type { Lead } from "@/types";
import {
  activityStart,
  buildCommercialCalendarEvents,
  durationMinutes,
} from "./commercial-calendar";

function leadWithActivities(activities: Lead["activities"]): Lead {
  return {
    id: "lead-1",
    companyName: "Clínica Exemplo",
    category: "Clínica",
    address: "Rua A",
    city: "Rio de Janeiro",
    state: "RJ",
    latitude: 0,
    longitude: 0,
    distanceKm: 1,
    hasWebsite: false,
    score: 80,
    temperature: "hot",
    stage: "new",
    discoveredAt: "2026-08-01T12:00:00.000Z",
    notes: [],
    activities,
    timeline: [],
  };
}

describe("commercial calendar", () => {
  test("combines the persisted date with the explicit local time", () => {
    const start = activityStart("2026-08-08T00:00:00", "14:30");
    expect(start?.getHours()).toBe(14);
    expect(start?.getMinutes()).toBe(30);
  });

  test("builds one timed event per activity without cadence duplicates", () => {
    const events = buildCommercialCalendarEvents([
      leadWithActivities([
        {
          id: "activity-1",
          type: "meeting",
          title: "Reunião comercial",
          date: "2026-08-08T14:30:00",
          time: "14:30",
          scheduledEndAt: "2026-08-08T15:30:00",
          done: false,
        },
      ]),
    ]);

    expect(events).toHaveLength(1);
    expect(events[0]?.allDay).toBe(false);
    expect(durationMinutes(events[0]!)).toBe(60);
  });

  test("uses a safe default duration when no end was persisted", () => {
    const [event] = buildCommercialCalendarEvents([
      leadWithActivities([
        {
          id: "activity-1",
          type: "call",
          title: "Ligação",
          date: "2026-08-08T14:30:00",
          time: "14:30",
        },
      ]),
    ]);

    expect(durationMinutes(event!)).toBe(30);
  });
});
