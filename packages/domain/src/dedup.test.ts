import { describe, expect, test } from "bun:test";
import { dedupeCandidates, matchConfidence, type DedupRecord } from "./dedup";

const base: DedupRecord = {
  id: "1",
  name: "Clínica São José",
  phone: "51 99876-5432",
  website: "https://clinicasaojose.com.br",
  latitude: -30.0346,
  longitude: -51.2177,
  city: "Porto Alegre",
  state: "RS",
  source: "overpass",
  externalId: "node/1",
};

describe("matchConfidence", () => {
  test("identical external id -> certain merge", () => {
    const m = matchConfidence(base, { ...base, id: "2" });
    expect(m.confidence).toBe(1);
    expect(m.merge).toBe(true);
  });

  test("same domain + phone + name variant -> merge", () => {
    const other: DedupRecord = {
      id: "2",
      name: "CLINICA SAO JOSE LTDA",
      phone: "+5551998765432",
      website: "http://www.clinicasaojose.com.br",
      latitude: -30.0347,
      longitude: -51.2178,
      city: "Porto Alegre",
      source: "google",
      externalId: "places/xyz",
    };
    const m = matchConfidence(base, other);
    expect(m.signals).toContain("domain");
    expect(m.signals).toContain("phone");
    expect(m.merge).toBe(true);
  });

  test("name-only match stays below merge threshold (no merge on name alone)", () => {
    const a: DedupRecord = { id: "1", name: "Padaria Central" };
    const b: DedupRecord = { id: "2", name: "Padaria Central" };
    const m = matchConfidence(a, b);
    expect(m.merge).toBe(false);
    expect(m.confidence).toBeLessThan(0.7);
  });

  test("different businesses -> distinct", () => {
    const a: DedupRecord = { id: "1", name: "Padaria Central", phone: "5133210001" };
    const b: DedupRecord = { id: "2", name: "Auto Peças Silva", phone: "5133219999" };
    const m = matchConfidence(a, b);
    expect(m.merge).toBe(false);
    expect(m.review).toBe(false);
  });
});

describe("dedupeCandidates", () => {
  const dupes: DedupRecord[] = [
    base,
    { ...base, id: "2", name: "Clinica Sao Jose", externalId: "node/2", source: "overpass" },
    { id: "3", name: "Farmácia Bem Estar", phone: "5133215555", externalId: "node/3", source: "overpass" },
  ];

  test("merges the two São José, keeps the farmácia apart", () => {
    const clusters = dedupeCandidates(dupes);
    expect(clusters.length).toBe(2);
    const main = clusters.find((c) => c.canonicalId === "1")!;
    expect(main.memberIds.sort()).toEqual(["1", "2"]);
  });

  test("idempotent: clustering canonical-only records yields singletons", () => {
    const canon: DedupRecord[] = [
      { id: "a", name: "Alpha", externalId: "x/1", source: "s" },
      { id: "b", name: "Beta", externalId: "x/2", source: "s" },
    ];
    const once = dedupeCandidates(canon);
    expect(once.length).toBe(2);
    const twice = dedupeCandidates(once.map((c) => canon.find((r) => r.id === c.canonicalId)!));
    expect(twice.length).toBe(2);
  });
});
