import { test, expect, beforeEach } from "bun:test";
import { useSearchDraftStore } from "./index";
import type { Search } from "@/types";

const initial = useSearchDraftStore.getState().draft;
beforeEach(() => useSearchDraftStore.setState({ draft: { ...initial } }));

test("setDraft patches a single field", () => {
  useSearchDraftStore.getState().setDraft({ radiusKm: 50 });
  expect(useSearchDraftStore.getState().draft.radiusKm).toBe(50);
  expect(useSearchDraftStore.getState().draft.niche).toBe(initial.niche);
});

test("resetDraftTo hydrates draft from a committed Search", () => {
  const search = {
    id: "s1",
    niche: "Padaria",
    location: "Centro, POA",
    latitude: -30.03,
    longitude: -51.22,
    radiusKm: 20,
    presence: "all",
    createdAt: "",
    totalFound: 0,
    enrichedCount: 0,
    addedToPipeline: 0,
    contactsFound: 0,
  } satisfies Search;
  useSearchDraftStore.getState().resetDraftTo(search);
  const d = useSearchDraftStore.getState().draft;
  expect(d).toEqual({
    niche: "Padaria",
    location: "Centro, POA",
    coords: { lat: -30.03, lng: -51.22 },
    radiusKm: 20,
    presence: "all",
  });
});
