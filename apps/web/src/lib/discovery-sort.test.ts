import { describe, expect, test } from "bun:test";
import { sortDiscoveryResults } from "./discovery-sort";
import type { DiscoveryResult } from "@leads/contracts";

// FASE C2: esta é a fonte ÚNICA de ordenação de resultados de descoberta —
// AppSidebar (painel) e ResultsList (lista principal, via app.mapa.tsx) usam
// os DOIS esta mesma função agora. Antes, cada superfície tinha sua própria
// cópia (ou, no caso da lista principal, nenhuma) e a MESMA busca aparecia
// em ordens diferentes nas duas telas.
function result(partial: Partial<DiscoveryResult>): DiscoveryResult {
  return {
    placeId: "p",
    name: "Empresa",
    category: null,
    latitude: -22.9,
    longitude: -43.1,
    address: null,
    neighborhood: null,
    city: null,
    state: null,
    phone: null,
    website: null,
    hasWebsite: false,
    email: null,
    instagram: null,
    whatsapp: null,
    rating: null,
    reviewCount: null,
    distanceKm: 0,
    score: 50,
    temperature: "warm",
    importedLeadId: null,
    enrichmentState: "pending",
    enrichmentFields: null,
    primaryCnae: null,
    cnaeDescription: null,
    secondaryCnaes: null,
    decisionMakerCount: 0,
    topDecisionMakerBand: null,
    topDecisionMakerScore: null,
    ...partial,
  };
}

describe("sortDiscoveryResults", () => {
  test("score: maior primeiro", () => {
    const items = [
      result({ placeId: "a", score: 40 }),
      result({ placeId: "b", score: 90 }),
      result({ placeId: "c", score: 65 }),
    ];
    expect(sortDiscoveryResults(items, "score").map((r) => r.placeId)).toEqual(["b", "c", "a"]);
  });

  test("distance: menor primeiro, desconhecida (null) vai pro FIM, nunca pro topo", () => {
    const items = [
      result({ placeId: "far", distanceKm: 20 }),
      result({ placeId: "unknown", distanceKm: null }),
      result({ placeId: "near", distanceKm: 2 }),
    ];
    // Se null virasse 0 (`?? 0`), "unknown" apareceria como o mais perto —
    // exatamente a mentira que outros lotes desta sessão já corrigiram.
    expect(sortDiscoveryResults(items, "distance").map((r) => r.placeId)).toEqual([
      "near",
      "far",
      "unknown",
    ]);
  });

  test("rating: maior primeiro, sem avaliação conta como 0 (vai pro fim)", () => {
    const items = [
      result({ placeId: "a", rating: 3.5 }),
      result({ placeId: "b", rating: null }),
      result({ placeId: "c", rating: 4.8 }),
    ];
    expect(sortDiscoveryResults(items, "rating").map((r) => r.placeId)).toEqual(["c", "a", "b"]);
  });

  test("reviews: maior primeiro", () => {
    const items = [
      result({ placeId: "a", reviewCount: 12 }),
      result({ placeId: "b", reviewCount: 340 }),
      result({ placeId: "c", reviewCount: null }),
    ];
    expect(sortDiscoveryResults(items, "reviews").map((r) => r.placeId)).toEqual(["b", "a", "c"]);
  });

  test("não muta o array original", () => {
    const items = [result({ placeId: "a", score: 10 }), result({ placeId: "b", score: 90 })];
    const sorted = sortDiscoveryResults(items, "score");
    expect(items.map((r) => r.placeId)).toEqual(["a", "b"]); // input intocado
    expect(sorted.map((r) => r.placeId)).toEqual(["b", "a"]);
  });
});
