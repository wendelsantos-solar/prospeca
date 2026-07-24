import { describe, it, expect } from "bun:test";
import { parseAddress } from "./address";

describe("parseAddress — formatted_address (search path)", () => {
  it("splits street, neighborhood, city and UF", () => {
    expect(
      parseAddress("R. Osvaldo Aranha, 1664 - Buritis, Belo Horizonte - MG, 30575-100, Brazil"),
    ).toEqual({
      street: "R. Osvaldo Aranha, 1664",
      neighborhood: "Buritis",
      city: "Belo Horizonte",
      state: "MG",
    });
  });

  it("handles an address without neighborhood", () => {
    expect(parseAddress("Av. Paulista, 1000, São Paulo - SP, 01310-100, Brasil")).toEqual({
      street: "Av. Paulista, 1000",
      neighborhood: null,
      city: "São Paulo",
      state: "SP",
    });
  });

  it("keeps compound city names intact", () => {
    expect(
      parseAddress("Rua União, 2043 - Vila Madalena, Ribeirão Preto - SP, 14020-000, Brazil"),
    ).toEqual({
      street: "Rua União, 2043",
      neighborhood: "Vila Madalena",
      city: "Ribeirão Preto",
      state: "SP",
    });
  });

  it("degrades to street-only when there is no city/UF anchor", () => {
    expect(parseAddress("Rodovia BR-101, km 12")).toEqual({
      street: "Rodovia BR-101, km 12",
      neighborhood: null,
      city: null,
      state: null,
    });
  });

  it("returns all-null for empty input", () => {
    expect(parseAddress(null)).toEqual({
      street: null,
      neighborhood: null,
      city: null,
      state: null,
    });
  });
});

describe("parseAddress — address_components (refresh-place-details path)", () => {
  const components = [
    { longText: "1664", shortText: "1664", types: ["street_number"] },
    { longText: "Rua Osvaldo Aranha", shortText: "R. Osvaldo Aranha", types: ["route"] },
    { longText: "Buritis", shortText: "Buritis", types: ["sublocality_level_1", "sublocality"] },
    { longText: "Belo Horizonte", shortText: "Belo Horizonte", types: ["locality"] },
    { longText: "Minas Gerais", shortText: "MG", types: ["administrative_area_level_1"] },
  ];

  it("prefers structured components over the formatted string", () => {
    expect(parseAddress("Ignorado, 1 - X, Y - SP, Brazil", components)).toEqual({
      street: "Rua Osvaldo Aranha, 1664",
      neighborhood: "Buritis",
      city: "Belo Horizonte",
      state: "MG",
    });
  });

  it("accepts the legacy Geocoding shape (long_name/short_name)", () => {
    expect(
      parseAddress(null, [
        { long_name: "Curitiba", short_name: "Curitiba", types: ["locality"] },
        { long_name: "Paraná", short_name: "PR", types: ["administrative_area_level_1"] },
      ]),
    ).toEqual({ street: null, neighborhood: null, city: "Curitiba", state: "PR" });
  });

  it("falls back to the formatted string for parts the components lack", () => {
    const partial = [{ longText: "Centro", types: ["neighborhood"] }];
    expect(parseAddress("Rua A, 10 - Outro, Salvador - BA, Brazil", partial)).toEqual({
      street: "Rua A, 10",
      neighborhood: "Centro",
      city: "Salvador",
      state: "BA",
    });
  });
});
