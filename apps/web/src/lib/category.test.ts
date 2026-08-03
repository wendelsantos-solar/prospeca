import { expect, test } from "bun:test";
import { categoryLabel } from "./category";

test("categoryLabel normaliza a capitalização de categorias acentuadas", () => {
  expect(categoryLabel("clíNICA MÉDICA")).toBe("Clínica Médica");
  expect(categoryLabel("salão de beleza")).toBe("Salão De Beleza");
  expect(categoryLabel("escritório_de_advocacia")).toBe("Escritório De Advocacia");
});

test("categoryLabel preserva os rótulos conhecidos em português", () => {
  expect(categoryLabel("dental_clinic")).toBe("Clínica odontológica");
});
