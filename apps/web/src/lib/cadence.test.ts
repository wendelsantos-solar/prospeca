import { test, expect } from "bun:test";
import { currentCadenceStep, nextCadenceStep, cadenceStepDueDate, CADENCE_STEPS } from "./cadence";
import type { Lead } from "@/types";

const NOW = new Date("2026-08-01T12:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString();

const base = (overrides: Partial<Lead>): Lead => ({
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
  cadenceStep: 0,
  discoveredAt: NOW.toISOString(),
  notes: [],
  activities: [],
  timeline: [],
  ...overrides,
});

test("a cadência não começa até o primeiro contato ser confirmado", () => {
  const lead = base({ cadenceStartedAt: undefined });
  expect(currentCadenceStep(lead, NOW)).toBeNull();
  expect(nextCadenceStep(lead, NOW)).toBeNull();
});

test("a primeira etapa fica próxima antes de D+2 e vencida a partir de D+2", () => {
  const future = base({ cadenceStartedAt: daysAgo(1) });
  expect(currentCadenceStep(future, NOW)).toBeNull();
  expect(nextCadenceStep(future, NOW)?.order).toBe(1);

  const due = base({ cadenceStartedAt: daysAgo(2) });
  expect(currentCadenceStep(due, NOW)?.order).toBe(1);
});

test("uma etapa atrasada não é pulada sem confirmação", () => {
  const lead = base({ cadenceStartedAt: daysAgo(10), cadenceStep: 0 });
  expect(currentCadenceStep(lead, NOW)?.order).toBe(1);
});

test("depois de confirmar uma etapa, a próxima usa a âncora original", () => {
  const lead = base({ cadenceStartedAt: daysAgo(5), cadenceStep: 1 });
  expect(currentCadenceStep(lead, NOW)?.order).toBe(2);
  expect(cadenceStepDueDate(lead, CADENCE_STEPS[1])).toBe("2026-07-31T12:00:00.000Z");
});

test("a cadência termina depois do último toque confirmado", () => {
  const lead = base({
    cadenceStartedAt: daysAgo(30),
    cadenceStep: CADENCE_STEPS.length,
    cadenceCompletedAt: NOW.toISOString(),
  });
  expect(currentCadenceStep(lead, NOW)).toBeNull();
  expect(nextCadenceStep(lead, NOW)).toBeNull();
});

test("uma resposta encerra a cadência mesmo antes do último toque", () => {
  const lead = base({
    cadenceStartedAt: daysAgo(5),
    cadenceStep: 1,
    cadenceCompletedAt: NOW.toISOString(),
  });
  expect(currentCadenceStep(lead, NOW)).toBeNull();
  expect(nextCadenceStep(lead, NOW)).toBeNull();
});

test("cadenceStepDueDate exige a âncora persistida", () => {
  expect(cadenceStepDueDate(base({ cadenceStartedAt: undefined }), CADENCE_STEPS[0])).toBeNull();
});
