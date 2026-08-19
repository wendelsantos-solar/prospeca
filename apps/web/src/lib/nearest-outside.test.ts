import { describe, expect, test } from "bun:test";
import { radiusToReach, nearestOutsideDescription, MAX_RADIUS_KM } from "./nearest-outside";

describe("radiusToReach", () => {
  test("escolhe o MENOR raio da escala que alcança a ocorrência", () => {
    expect(radiusToReach(3)).toBe(5);
    expect(radiusToReach(10)).toBe(10);
    expect(radiusToReach(10.1)).toBe(20);
    expect(radiusToReach(45)).toBe(50);
  });

  test("null quando a ocorrência está além do raio máximo buscável", () => {
    // Caso REAL da fixture: barbearia mais próxima de SP está em Curitiba,
    // a 335 km — além do teto de 100 km do controle de raio. Oferecer o botão
    // aqui seria repetir a mentira do P0 ("aumente o raio" sem resolver).
    expect(radiusToReach(335.3)).toBeNull();
    expect(radiusToReach(MAX_RADIUS_KM + 0.1)).toBeNull();
    expect(radiusToReach(MAX_RADIUS_KM)).toBe(MAX_RADIUS_KM);
  });
});

describe("nearestOutsideDescription", () => {
  const curitiba = { name: "Barbearia do Beto", city: "Curitiba", state: "PR", distanceKm: 335.3 };

  test("diz cidade, estado e distância", () => {
    expect(nearestOutsideDescription(curitiba)).toContain("Curitiba (PR)");
    expect(nearestOutsideDescription(curitiba)).toContain("335,3 km");
  });

  test("avisa quando está além do raio máximo, em vez de sugerir ampliar", () => {
    expect(nearestOutsideDescription(curitiba)).toContain("raio máximo");
  });

  test("não menciona o teto quando a ampliação é possível", () => {
    const perto = { ...curitiba, city: "Osasco", distanceKm: 18 };
    expect(nearestOutsideDescription(perto)).not.toContain("raio máximo");
  });
});
