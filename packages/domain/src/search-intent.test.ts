import { describe, expect, test } from "bun:test";
import { parseSearchIntent } from "./search-intent";

describe("parseSearchIntent", () => {
  test("barbearias com baixa presença digital em Campo Grande", () => {
    const r = parseSearchIntent("barbearias com baixa presença digital em Campo Grande");
    expect(r.businessIntent).toBe("barbearias");
    expect(r.location).toBe("campo grande");
    expect(r.presence).toBe("no-website");
    expect(r.digitalPresence.website).toBe(false);
  });

  test("clínicas odontológicas em Niterói sem site e com boas avaliações", () => {
    const r = parseSearchIntent("clínicas odontológicas em Niterói sem site e com boas avaliações");
    expect(r.businessIntent).toBe("clínicas odontológicas");
    expect(r.location).toBe("niterói");
    expect(r.presence).toBe("no-website");
    expect(r.ratingMin).toBe(4);
  });

  test("com site + radius", () => {
    const r = parseSearchIntent("restaurantes com site em São Paulo num raio de 10 km");
    expect(r.presence).toBe("with-website");
    expect(r.digitalPresence.website).toBe(true);
    expect(r.radiusKm).toBe(10);
    expect(r.location).toBe("são paulo");
  });

  test("decimal radius", () => {
    const r = parseSearchIntent("academias em Curitiba raio de 5,5 km");
    expect(r.radiusKm).toBe(5.5);
    expect(r.location).toBe("curitiba");
  });

  test("no presence / no location → all + empty location", () => {
    const r = parseSearchIntent("pizzarias");
    expect(r.presence).toBe("all");
    expect(r.digitalPresence.website).toBeNull();
    expect(r.location).toBe("");
    expect(r.businessIntent).toBe("pizzarias");
  });

  test("raw is preserved", () => {
    const r = parseSearchIntent("  Barbearias em Campo Grande  ");
    expect(r.raw).toBe("Barbearias em Campo Grande");
  });
});
