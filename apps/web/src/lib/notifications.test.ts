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

test("HOT lead with no online presence → produces an intent_signal notification", () => {
  const lead = base({
    id: "lead-4",
    companyName: "Invisible",
    hasWebsite: false,
    temperature: "hot",
  });
  const notifs = generateNotifications([lead]);
  const intent = notifs.filter((n) => n.kind === "intent_signal");
  expect(intent).toHaveLength(1);
  expect(intent[0].title).toContain("Invisível online");
  expect(intent[0].leadId).toBe("lead-4");
  expect(intent[0].id).toBe("intent:NO_ONLINE_PRESENCE:lead-4");
});

test("HOT lead with rating < 3.0 → critical reputation intent_signal", () => {
  const lead = base({
    id: "lead-5",
    companyName: "Bad Rep",
    hasWebsite: true,
    rating: 2.5,
    reviewCount: 40,
    temperature: "hot",
  });
  const notifs = generateNotifications([lead]);
  const intent = notifs.filter((n) => n.kind === "intent_signal");
  expect(intent.some((n) => n.title.includes("Reputação crítica"))).toBe(true);
});

test("WARM/COLD leads do NOT emit intent_signal (only hot gates it)", () => {
  const warm = base({ id: "lead-6", companyName: "Warm", hasWebsite: false, temperature: "warm" });
  const cold = base({ id: "lead-7", companyName: "Cold", hasWebsite: false, temperature: "cold" });
  const notifs = generateNotifications([warm, cold]);
  expect(notifs.filter((n) => n.kind === "intent_signal")).toHaveLength(0);
});

test("dedupe by key: same lead+signal → ONE notification; signal cleared → gone", () => {
  // Two derivations of the same snapshot produce identical keys (stable identity).
  const lead = base({
    id: "lead-8",
    companyName: "Dedupe",
    hasWebsite: false,
    temperature: "hot",
  });
  const run1 = generateNotifications([lead]);
  const run2 = generateNotifications([lead]);
  const keys1 = run1.filter((n) => n.kind === "intent_signal").map((n) => n.id);
  const keys2 = run2.filter((n) => n.kind === "intent_signal").map((n) => n.id);
  expect(keys1).toEqual(keys2);
  expect(keys1).toHaveLength(1);

  // Signal cleared (website appears) → no intent notification anymore — the
  // server-side cleanup deletes the row; if it returns, the SAME key comes
  // back as a new (unread) event.
  const healed = base({
    id: "lead-8",
    companyName: "Dedupe",
    hasWebsite: true,
    whatsapp: "+5511999999999",
    temperature: "hot",
  });
  const run3 = generateNotifications([healed]);
  expect(run3.filter((n) => n.kind === "intent_signal")).toHaveLength(0);
});
