import { test, expect } from "bun:test";
import { generateNotifications } from "./notifications";
import type { Lead } from "@/types";

const base = (o: Partial<Lead>): Lead => ({
  id: "1",
  companyName: "Test Company",
  category: "Technology",
  address: "123 Main St",
  city: "São Paulo",
  state: "SP",
  latitude: -23.5505,
  longitude: -46.6333,
  distanceKm: 5,
  hasWebsite: true,
  score: 50,
  temperature: "warm",
  stage: "new",
  discoveredAt: new Date().toISOString(),
  notes: [],
  activities: [],
  timeline: [],
  ...o,
});

test("lead with an open activity (date in past, done falsy) → produces one overdue_activity notification", () => {
  const pastDate = new Date(Date.now() - 2 * 86400000).toISOString(); // 2 days ago
  const lead = base({
    id: "lead-1",
    companyName: "Test Lead",
    stage: "contacted",
    activities: [
      {
        id: "activity-1",
        type: "call",
        title: "Follow-up call",
        date: pastDate,
        done: false, // open activity
      },
    ],
  });

  const notifs = generateNotifications([lead]);

  expect(notifs).toHaveLength(1);
  expect(notifs[0].kind).toBe("overdue_activity");
  expect(notifs[0].leadId).toBe("lead-1");
  expect(notifs[0].title).toContain("Test Lead");
  expect(notifs[0].description).toBe("Follow-up call");
});

test("contacted lead with lastInteractionAt ~8 days ago and no open activity → produces one stalled_lead notification", () => {
  const eightDaysAgo = new Date(Date.now() - 8 * 86400000).toISOString();
  const lead = base({
    id: "lead-2",
    companyName: "Stalled Lead",
    stage: "contacted",
    lastInteractionAt: eightDaysAgo,
    activities: [
      {
        id: "activity-1",
        type: "call",
        title: "Previous call",
        date: eightDaysAgo,
        done: true, // completed activity (not open)
      },
    ],
  });

  const notifs = generateNotifications([lead]);

  expect(notifs).toHaveLength(1);
  expect(notifs[0].kind).toBe("stalled_lead");
  expect(notifs[0].leadId).toBe("lead-2");
  expect(notifs[0].title).toContain("Stalled Lead");
});

test("won lead → produces zero notifications (excluded)", () => {
  const lead = base({
    id: "lead-3",
    companyName: "Won Lead",
    stage: "won",
    activities: [
      {
        id: "activity-1",
        type: "call",
        title: "Call",
        date: new Date().toISOString(),
        done: false,
      },
    ],
  });

  const notifs = generateNotifications([lead]);

  expect(notifs).toHaveLength(0);
});

test("lead with no online presence → produces an intent (info) notification", () => {
  const lead = base({ id: "lead-4", companyName: "Invisible", hasWebsite: false });
  const notifs = generateNotifications([lead]);
  const intent = notifs.filter((n) => n.kind === "info");
  expect(intent).toHaveLength(1);
  expect(intent[0].title).toContain("Invisível online");
  expect(intent[0].leadId).toBe("lead-4");
});

test("lead with rating < 3.0 → produces a critical reputation intent notification", () => {
  const lead = base({
    id: "lead-5",
    companyName: "Bad Rep",
    hasWebsite: true,
    rating: 2.5,
    reviewCount: 40,
  });
  const notifs = generateNotifications([lead]);
  const intent = notifs.filter((n) => n.kind === "info");
  expect(intent.some((n) => n.title.includes("Reputação crítica"))).toBe(true);
});
