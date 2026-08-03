import { expect, test } from "bun:test";
import { passwordPolicy, passwordSchema } from "./password-policy";

test("passwordSchema aceita uma senha que atende todos os requisitos publicados", () => {
  expect(passwordSchema.safeParse("Radar@2026").success).toBe(true);
});

test("passwordSchema rejeita cada requisito ausente", () => {
  expect(passwordSchema.safeParse("Curta@1").success).toBe(false);
  expect(passwordSchema.safeParse("radar@2026").success).toBe(false);
  expect(passwordSchema.safeParse("RadarLocal@").success).toBe(false);
  expect(passwordSchema.safeParse("Radar2026").success).toBe(false);
});

test("passwordPolicy expõe a mesma regra usada na validação", () => {
  const statuses = passwordPolicy("Radar@2026");
  expect(statuses.every((requirement) => requirement.met)).toBe(true);
  expect(statuses.map((requirement) => requirement.label)).toEqual([
    "Mínimo de 8 caracteres",
    "Pelo menos 1 letra maiúscula",
    "Pelo menos 1 número",
    "Pelo menos 1 caractere especial",
  ]);
});
