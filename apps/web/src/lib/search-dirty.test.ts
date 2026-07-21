import { test, expect } from "bun:test";
import { classifyDirty } from "./search-dirty";
import type { Search } from "@/types";
import type { SearchDraft } from "@/stores";

const current: Search = {
  id: "s1",
  niche: "Clínica",
  location: "POA",
  latitude: -30.03,
  longitude: -51.22,
  radiusKm: 30,
  presence: "all",
  createdAt: "",
  totalFound: 0,
  enrichedCount: 0,
  addedToPipeline: 0,
  contactsFound: 0,
};
const base: SearchDraft = {
  niche: "Clínica",
  location: "POA",
  coords: { lat: -30.03, lng: -51.22 },
  radiusKm: 30,
  presence: "all",
};

test("identical draft is not dirty", () => {
  expect(classifyDirty(base, current)).toEqual({ dirty: false, reason: "none", clientOnly: false });
});
test("no current search → never dirty", () => {
  expect(classifyDirty(base, null).dirty).toBe(false);
});
test("niche change is dirty", () => {
  expect(classifyDirty({ ...base, niche: "Padaria" }, current)).toMatchObject({
    dirty: true,
    reason: "niche",
  });
});
test("moving center is dirty (location)", () => {
  expect(classifyDirty({ ...base, coords: { lat: -25, lng: -49 } }, current)).toMatchObject({
    dirty: true,
    reason: "location",
  });
});
test("radius down is client-only, not dirty", () => {
  expect(classifyDirty({ ...base, radiusKm: 10 }, current)).toMatchObject({
    dirty: false,
    clientOnly: true,
  });
});
test("radius up is dirty", () => {
  expect(classifyDirty({ ...base, radiusKm: 50 }, current)).toMatchObject({
    dirty: true,
    reason: "radius-up",
  });
});
test("all → no-website is client-only (subset)", () => {
  expect(classifyDirty({ ...base, presence: "no-website" }, current)).toMatchObject({
    dirty: false,
    clientOnly: true,
  });
});
test("no-website → all is dirty (wider)", () => {
  const cur = { ...current, presence: "no-website" as const };
  expect(classifyDirty({ ...base, presence: "all" }, cur)).toMatchObject({
    dirty: true,
    reason: "presence-wider",
  });
});
test("no-website → with-website is dirty (different set)", () => {
  const cur = { ...current, presence: "no-website" as const };
  expect(classifyDirty({ ...base, presence: "with-website" }, cur)).toMatchObject({
    dirty: true,
    reason: "presence-wider",
  });
});
