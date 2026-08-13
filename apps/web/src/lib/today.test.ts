import { test, expect } from "bun:test";
import { buildTodayGroups } from "./today";
import type { Lead, LeadActivity } from "@/types";

const base = (o: Partial<Lead>): Lead => ({
  id: "1",
  companyName: "Test Company",
  category: "test",
  address: "",
  city: "",
  state: "",
  latitude: 0,
  longitude: 0,
  distanceKm: 0,
  hasWebsite: false,
  score: 50,
  temperature: "warm",
  stage: "contacted",
  discoveredAt: new Date().toISOString(),
  notes: [],
  activities: [],
  timeline: [],
  ...o,
});

const baseActivity = (o: Partial<LeadActivity>): LeadActivity => ({
  id: "a1",
  type: "call",
  title: "Test Activity",
  date: new Date().toISOString(),
  done: false,
  ...o,
});

test("open activity with date in the past → overdue group", () => {
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const lead = base({
    id: "lead1",
    activities: [baseActivity({ id: "a1", date: yesterday, done: false })],
  });
  const groups = buildTodayGroups([lead]);
  const overdue = groups.find((g) => g.id === "overdue");
  expect(overdue?.items.length).toBe(1);
  expect(overdue?.items[0].groupId).toBe("overdue");
});

test("open activity with date today → today group", () => {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const lead = base({
    id: "lead2",
    activities: [baseActivity({ id: "a1", date: today.toISOString(), done: false })],
  });
  const groups = buildTodayGroups([lead]);
  const todayGroup = groups.find((g) => g.id === "today");
  expect(todayGroup?.items.length).toBe(1);
  expect(todayGroup?.items[0].groupId).toBe("today");
});

test("new lead with no lastInteractionAt and no activities → first_reach group", () => {
  const lead = base({
    id: "lead3",
    stage: "new",
    lastInteractionAt: undefined,
    activities: [],
  });
  const groups = buildTodayGroups([lead]);
  const firstReach = groups.find((g) => g.id === "first_reach");
  expect(firstReach?.items.length).toBe(1);
  expect(firstReach?.items[0].groupId).toBe("first_reach");
});

test("won lead → excluded entirely", () => {
  const lead = base({
    id: "lead4",
    stage: "won",
    activities: [],
  });
  const groups = buildTodayGroups([lead]);
  const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);
  expect(totalItems).toBe(0);
});

test("discarded lead → excluded entirely", () => {
  const lead = base({
    id: "lead5",
    stage: "discarded",
    activities: [],
  });
  const groups = buildTodayGroups([lead]);
  const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);
  expect(totalItems).toBe(0);
});

test("contacted lead 3 days since confirmed contact, no scheduled activity → overdue cadence reminder, not no_next", () => {
  // Day 3 is past the first cadence step's D+2 threshold, so its due date
  // (lastInteractionAt + 2 days) already fell in the past.
  const confirmedAt = new Date(Date.now() - 3 * 86400000).toISOString();
  const lead = base({
    id: "lead6",
    stage: "contacted",
    lastInteractionAt: confirmedAt,
    cadenceStartedAt: confirmedAt,
    activities: [baseActivity({ id: "a1", done: true })], // completed activity
  });
  const groups = buildTodayGroups([lead]);
  const overdue = groups.find((g) => g.id === "overdue");
  const noNext = groups.find((g) => g.id === "no_next");
  expect(overdue?.items.length).toBe(1);
  expect(overdue?.items[0].label).toContain("Cadência");
  expect(noNext?.items.length ?? 0).toBe(0);
});

test("contacted lead 0 days since confirmed contact, no scheduled activity → upcoming cadence reminder", () => {
  // Too soon for step 1 (D+2) to be due yet, but its due date is within
  // the 7-day upcoming window.
  const confirmedAt = new Date().toISOString();
  const lead = base({
    id: "lead6b",
    stage: "contacted",
    lastInteractionAt: confirmedAt,
    cadenceStartedAt: confirmedAt,
    activities: [],
  });
  const groups = buildTodayGroups([lead]);
  const upcoming = groups.find((g) => g.id === "upcoming");
  expect(upcoming?.items.length).toBe(1);
  expect(upcoming?.items[0].label).toContain("Cadência");
});

test("contacted lead without a confirmed cadence anchor → falls back to no_next with a clear next step", () => {
  const lead = base({
    id: "lead6c",
    stage: "contacted",
    lastInteractionAt: new Date().toISOString(),
    cadenceStartedAt: undefined,
    activities: [],
  });
  const groups = buildTodayGroups([lead]);
  const noNext = groups.find((g) => g.id === "no_next");
  expect(noNext?.items.length).toBe(1);
  expect(noNext?.items[0].label).toBe("Confirmar primeiro contato");
});

test("contacted lead with completed cadence → no_next with 'concluída' label", () => {
  const lead = base({
    id: "lead6d",
    stage: "contacted",
    cadenceStartedAt: new Date().toISOString(),
    cadenceCompletedAt: new Date().toISOString(),
    cadenceStep: 4,
    activities: [],
  });
  const groups = buildTodayGroups([lead]);
  const noNext = groups.find((g) => g.id === "no_next");
  expect(noNext?.items.length).toBe(1);
  expect(noNext?.items[0].label).toBe("Cadência concluída — definir próximo passo");
});

test("qualified lead with no activity → no_next with 'agendar' label", () => {
  const lead = base({
    id: "lead6e",
    stage: "qualified",
    activities: [],
  });
  const groups = buildTodayGroups([lead]);
  const noNext = groups.find((g) => g.id === "no_next");
  expect(noNext?.items.length).toBe(1);
  expect(noNext?.items[0].label).toBe("Qualificado — agendar próximo passo");
});

test("contacted lead whose next cadence step is >7 days out → upcoming, not no_next", () => {
  // cadenceStep 3 (follow-up 2 done) → next step "last-attempt" due at D+14,
  // beyond the 7-day window. It still has a defined action, so it must land in
  // upcoming with the cadence label, not be mislabeled as having no next step.
  const lead = base({
    id: "lead6f",
    stage: "contacted",
    lastInteractionAt: new Date().toISOString(),
    cadenceStartedAt: new Date().toISOString(),
    cadenceStep: 3,
    activities: [],
  });
  const groups = buildTodayGroups([lead]);
  const upcoming = groups.find((g) => g.id === "upcoming");
  const noNext = groups.find((g) => g.id === "no_next");
  expect(upcoming?.items.length).toBe(1);
  expect(upcoming?.items[0].label).toContain("Cadência");
  expect(noNext?.items.length ?? 0).toBe(0);
});

test("multiple leads in different stages", () => {
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const leads = [
    base({
      id: "overdue1",
      activities: [baseActivity({ id: "a1", date: yesterday, done: false })],
    }),
    base({
      id: "new1",
      stage: "new",
      lastInteractionAt: undefined,
      activities: [],
    }),
    base({
      id: "won1",
      stage: "won",
      activities: [],
    }),
  ];
  const groups = buildTodayGroups(leads);
  const overdue = groups.find((g) => g.id === "overdue");
  const firstReach = groups.find((g) => g.id === "first_reach");
  const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);
  expect(overdue?.items.length).toBe(1);
  expect(firstReach?.items.length).toBe(1);
  expect(totalItems).toBe(2); // only overdue1 and new1, won1 is excluded
});
