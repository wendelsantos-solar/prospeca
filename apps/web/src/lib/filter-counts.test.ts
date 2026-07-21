import { test, expect } from "bun:test";
import { quickFilterCounts } from "./filter-counts";
import type { Lead } from "@/types";

const lead = (over: Partial<Lead>): Lead =>
  ({
    id: "x",
    companyName: "",
    category: "",
    address: "",
    city: "",
    state: "",
    latitude: 0,
    longitude: 0,
    distanceKm: 0,
    hasWebsite: false,
    score: 50,
    temperature: "cold",
    stage: "new",
    discoveredAt: "",
    notes: [],
    activities: [],
    timeline: [],
    ...over,
  }) as Lead;

test("counts leads matching each chip over the active filter set", () => {
  const leads = [
    lead({ whatsapp: "1", temperature: "hot" }),
    lead({ whatsapp: "2", temperature: "cold" }),
    lead({ temperature: "hot" }),
  ];
  const counts = quickFilterCounts(leads, { quick: [] });
  expect(counts.whatsapp).toBe(2);
  expect(counts.hot).toBe(2);
});

test("counts respect already-active filters", () => {
  const leads = [
    lead({ whatsapp: "1", temperature: "hot" }),
    lead({ whatsapp: "2", temperature: "cold" }),
  ];
  const counts = quickFilterCounts(leads, { quick: ["hot"] });
  expect(counts.whatsapp).toBe(1); // only the hot+whatsapp lead
});
