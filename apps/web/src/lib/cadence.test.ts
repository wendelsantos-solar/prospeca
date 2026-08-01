import { test, expect } from "bun:test";
import { currentCadenceStep, nextCadenceStep, cadenceStepDueDate, CADENCE_STEPS } from "./cadence";
import type { Lead } from "@/types";

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

const base = (o: Partial<Lead>): Lead => ({
  id: "1",
  companyName: "X",
  category: "c",
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

test("currentCadenceStep is null for non-contacted leads", () => {
  expect(currentCadenceStep(base({ stage: "new", lastInteractionAt: daysAgo(5) }))).toBeNull();
});

test("currentCadenceStep is null with no lastInteractionAt", () => {
  expect(currentCadenceStep(base({ lastInteractionAt: undefined }))).toBeNull();
});

test("currentCadenceStep is null before the first step's day threshold", () => {
  expect(currentCadenceStep(base({ lastInteractionAt: daysAgo(1) }))).toBeNull();
});

test("currentCadenceStep returns step 1 right at its day threshold", () => {
  const step = currentCadenceStep(base({ lastInteractionAt: daysAgo(2) }));
  expect(step?.order).toBe(1);
});

test("currentCadenceStep returns the latest step whose threshold has passed, not the first", () => {
  // 8 days in: step 1 (day 2) and step 2 (day 4) have both passed, but not
  // step 3 (day 7 — wait, 8 >= 7, so step 3 applies). Use 5 days to land
  // strictly between step 2 (day 4) and step 3 (day 7).
  const step = currentCadenceStep(base({ lastInteractionAt: daysAgo(5) }));
  expect(step?.order).toBe(2);
});

test("currentCadenceStep returns the last step once past every threshold", () => {
  const step = currentCadenceStep(base({ lastInteractionAt: daysAgo(30) }));
  expect(step?.order).toBe(CADENCE_STEPS.length);
});

test("nextCadenceStep returns the step still ahead, not the one already due", () => {
  const step = nextCadenceStep(base({ lastInteractionAt: daysAgo(1) }));
  expect(step?.order).toBe(1);
});

test("nextCadenceStep is null once the last step is due (nothing left to schedule)", () => {
  const step = nextCadenceStep(base({ lastInteractionAt: daysAgo(30) }));
  expect(step).toBeNull();
});

test("cadenceStepDueDate anchors on lastInteractionAt + the step's day offset", () => {
  const anchor = daysAgo(0);
  const due = cadenceStepDueDate({ lastInteractionAt: anchor } as Lead, CADENCE_STEPS[0]);
  const expected = new Date(anchor);
  expected.setDate(expected.getDate() + CADENCE_STEPS[0].dueAtDay);
  expect(due).toBe(expected.toISOString());
});

test("cadenceStepDueDate is null without a lastInteractionAt", () => {
  expect(cadenceStepDueDate({ lastInteractionAt: undefined } as Lead, CADENCE_STEPS[0])).toBeNull();
});
