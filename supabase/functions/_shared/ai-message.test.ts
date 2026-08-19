import { expect, test } from "bun:test";
import { hasEnoughSignal, buildUserPrompt, SYSTEM_PROMPT, type LeadSignal } from "./ai-message.ts";

const base = (o: Partial<LeadSignal>): LeadSignal => ({
  companyName: "Salão da Ana",
  category: "hair_salon",
  city: "Florianópolis",
  neighborhood: "Centro",
  hasWebsite: true,
  rating: null,
  reviewCount: null,
  ...o,
});

test("hasEnoughSignal: no website is always enough signal", () => {
  expect(hasEnoughSignal(base({ hasWebsite: false, rating: 4.8, reviewCount: 200 }))).toBe(true);
});

test("hasEnoughSignal: website + good rating + reviews is NOT enough", () => {
  expect(hasEnoughSignal(base({ hasWebsite: true, rating: 4.8, reviewCount: 50 }))).toBe(false);
});

test("hasEnoughSignal: website + low rating with 3+ reviews IS enough", () => {
  expect(hasEnoughSignal(base({ hasWebsite: true, rating: 3.2, reviewCount: 3 }))).toBe(true);
});

test("hasEnoughSignal: website + low rating but under 3 reviews is NOT enough", () => {
  expect(hasEnoughSignal(base({ hasWebsite: true, rating: 3.2, reviewCount: 2 }))).toBe(false);
});

test("hasEnoughSignal: website + zero reviews IS enough", () => {
  expect(hasEnoughSignal(base({ hasWebsite: true, rating: null, reviewCount: 0 }))).toBe(true);
});

test("hasEnoughSignal: website + no rating/reviews at all is NOT enough", () => {
  expect(hasEnoughSignal(base({ hasWebsite: true, rating: null, reviewCount: null }))).toBe(false);
});

test("buildUserPrompt includes company, humanized category, city, neighborhood, website + rating lines", () => {
  const prompt = buildUserPrompt(
    base({ hasWebsite: false, rating: 3.1, reviewCount: 5, category: "hair_salon" }),
  );
  expect(prompt).toContain("Empresa: Salão da Ana");
  expect(prompt).toContain("Categoria: hair salon");
  expect(prompt).toContain("Cidade: Florianópolis");
  expect(prompt).toContain("Bairro: Centro");
  expect(prompt).toContain("Tem site: não");
  expect(prompt).toContain("Nota: 3.1");
  expect(prompt).toContain("Número de avaliações: 5");
});

test("buildUserPrompt omits optional fields that are null", () => {
  const prompt = buildUserPrompt(
    base({ category: null, city: null, neighborhood: null, rating: null, reviewCount: null }),
  );
  expect(prompt).not.toContain("Categoria:");
  expect(prompt).not.toContain("Cidade:");
  expect(prompt).not.toContain("Bairro:");
  expect(prompt).not.toContain("Nota:");
  expect(prompt).not.toContain("Número de avaliações:");
});

// ── Decisor no prompt (People Intelligence) ─────────────────────────────────

test("decisor entra no prompt com nome e cargo", () => {
  const prompt = buildUserPrompt(
    base({ decisionMakerName: "MARIA SOUZA", decisionMakerRole: "Sócio-Administrador" }),
  );
  expect(prompt).toContain("Decisor: MARIA SOUZA (Sócio-Administrador)");
});

test("decisor sem cargo não inventa cargo no prompt", () => {
  const prompt = buildUserPrompt(base({ decisionMakerName: "MARIA SOUZA" }));
  expect(prompt).toContain("Decisor: MARIA SOUZA");
  expect(prompt).not.toContain("(");
});

test("sem decisor o prompt fica idêntico ao anterior", () => {
  expect(buildUserPrompt(base({}))).toBe(
    buildUserPrompt(base({ decisionMakerName: null, decisionMakerRole: null })),
  );
});

test("o sistema proíbe citar o cargo e proíbe inventar nome", () => {
  // O dado é contexto do vendedor, não abertura de conversa: dizer "vi que
  // você é sócio-administrador" numa primeira mensagem soa invasivo.
  expect(SYSTEM_PROMPT).toContain("PRIMEIRO NOME");
  expect(SYSTEM_PROMPT).toContain("Nunca cite o cargo societário");
  expect(SYSTEM_PROMPT).toContain("não invente nome");
});
