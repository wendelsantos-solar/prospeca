import { test, expect, beforeEach } from "bun:test";
import { useSearchDraftStore } from "./index";
import { MAX_RADIUS_KM } from "@/lib/nearest-outside";
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

test("resetDraftTo clampa raio de missão salva antes do LOTE 2 (teto era 100)", () => {
  const oldSearch = {
    id: "s2",
    niche: "Restaurante",
    location: "Rio de Janeiro",
    latitude: -22.9,
    longitude: -43.2,
    radiusKm: 100, // valor válido no teto antigo, inválido no atual (MAX_RADIUS_KM=50)
    presence: "all",
    createdAt: "",
    totalFound: 0,
    enrichedCount: 0,
    addedToPipeline: 0,
    contactsFound: 0,
  } satisfies Search;
  useSearchDraftStore.getState().resetDraftTo(oldSearch);
  // Sem o clamp, o slider (max=MAX_RADIUS_KM) herdava um valor fora do
  // próprio range — mesma classe de estado inválido silencioso do F3.
  expect(useSearchDraftStore.getState().draft.radiusKm).toBe(MAX_RADIUS_KM);
});
