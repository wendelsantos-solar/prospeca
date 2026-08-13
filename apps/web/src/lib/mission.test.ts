import { describe, expect, test } from "bun:test";
import { buildMissionPhrase, type MissionInput } from "./mission";

const base: MissionInput = {
  niche: "Barbearia",
  location: "Campo Grande, Rio de Janeiro",
  presence: "all",
  radiusKm: 5,
};

describe("buildMissionPhrase", () => {
  test("no-website → low digital presence qualifier", () => {
    expect(buildMissionPhrase({ ...base, presence: "no-website" })).toBe(
      "Barbearia com baixa presença digital em Campo Grande, Rio de Janeiro, raio 5 km",
    );
  });

  test("with-website → has a site", () => {
    expect(buildMissionPhrase({ ...base, presence: "with-website" })).toBe(
      "Barbearia com site próprio em Campo Grande, Rio de Janeiro, raio 5 km",
    );
  });

  test("all → no qualifier", () => {
    expect(buildMissionPhrase(base)).toBe("Barbearia em Campo Grande, Rio de Janeiro, raio 5 km");
  });

  test("empty niche or location → null", () => {
    expect(buildMissionPhrase({ ...base, niche: " " })).toBeNull();
    expect(buildMissionPhrase({ ...base, location: "" })).toBeNull();
  });

  test("zero radius omitted", () => {
    expect(buildMissionPhrase({ ...base, radiusKm: 0 })).toBe(
      "Barbearia em Campo Grande, Rio de Janeiro",
    );
  });
});
