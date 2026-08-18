import { expect, test } from "bun:test";
import {
  DECISION_MAKER_SCORE_VERSION,
  calculateDecisionMakerScore,
  classifyDecisionRole,
  compareDecisionMakers,
  normalizeRole,
  type DecisionMakerInput,
} from "./decision-maker.ts";

const NOW = new Date("2026-08-18T00:00:00Z");

const input = (o: Partial<DecisionMakerInput> = {}): DecisionMakerInput => ({
  role: "49-Sócio-Administrador",
  memberType: "person",
  isCurrent: true,
  confidence: 1,
  source: "qsa",
  startedAt: "2015-03-10",
  ...o,
});

test("normalizeRole tira acento, caixa e pontuação", () => {
  expect(normalizeRole("49-Sócio-Administrador")).toBe("49 socio administrador");
  expect(normalizeRole("DIRETOR")).toBe("diretor");
  expect(normalizeRole(null)).toBe("");
});

test("classifica as variações que a Receita realmente escreve", () => {
  for (const variant of [
    "Sócio-Administrador",
    "SOCIO ADMINISTRADOR",
    "49-Sócio-Administrador",
    "sócio administrador",
  ]) {
    expect(classifyDecisionRole(variant).band).toBe("high");
  }
});

test("bandas high / medium / low", () => {
  expect(classifyDecisionRole("Administrador").band).toBe("high");
  expect(classifyDecisionRole("Diretor").band).toBe("high");
  expect(classifyDecisionRole("Presidente").band).toBe("high");
  expect(classifyDecisionRole("Titular Pessoa Física").band).toBe("high");
  expect(classifyDecisionRole("Sócio").band).toBe("high");
  expect(classifyDecisionRole("Gerente Comercial").band).toBe("medium");
  expect(classifyDecisionRole("Coordenador").band).toBe("medium");
  expect(classifyDecisionRole("Procurador").band).toBe("medium");
  expect(classifyDecisionRole("Analista").band).toBe("low");
  expect(classifyDecisionRole("Estagiário").band).toBe("low");
});

test("regra específica vence a genérica (sócio administrador ≠ sócio)", () => {
  // Ambas são 'high', mas o MOTIVO precisa ser o específico.
  expect(classifyDecisionRole("Sócio-Administrador").reason).toBe("Sócio administrador");
  expect(classifyDecisionRole("Sócio").reason).toBe("Sócio");
});

test("cargo ausente/desconhecido é 'unknown', NUNCA 'low'", () => {
  // Confundir "não sei" com "irrelevante" esconderia decisor de verdade.
  expect(classifyDecisionRole(null).band).toBe("unknown");
  expect(classifyDecisionRole("").band).toBe("unknown");
  expect(classifyDecisionRole("Cargo Que Não Existe").band).toBe("unknown");
});

test("sócio administrador vigente do QSA → score alto e motivos explícitos", () => {
  const result = calculateDecisionMakerScore(input(), NOW);
  expect(result.version).toBe(DECISION_MAKER_SCORE_VERSION);
  expect(result.band).toBe("high");
  expect(result.score).toBe(100); // 70 + 15 (QSA) + 10 (PF) + 5 (tempo) = 100
  expect(result.reasons).toContain("Sócio administrador");
  expect(result.reasons).toContain("Relação confirmada pelo quadro societário (QSA)");
  expect(result.reasons.some((r) => r.includes("Na sociedade há"))).toBe(true);
});

test("score nunca sai sem motivo", () => {
  const result = calculateDecisionMakerScore(input({ role: null }), NOW);
  expect(result.reasons.length).toBeGreaterThan(0);
  expect(result.reasons[0]).toBe("Cargo não informado pela fonte");
});

test("relação não vigente derruba o score", () => {
  const current = calculateDecisionMakerScore(input(), NOW);
  const past = calculateDecisionMakerScore(input({ isCurrent: false }), NOW);
  expect(past.score).toBeLessThan(current.score);
  expect(past.reasons).toContain("Relação não consta mais no quadro vigente");
});

test("sócio PJ aponta o representante legal em vez de fingir que a holding decide", () => {
  const result = calculateDecisionMakerScore(
    input({ memberType: "company", legalRepresentativeName: "CARLOS LIMA" }),
    NOW,
  );
  expect(result.reasons.some((r) => r.includes("CARLOS LIMA"))).toBe(true);
  // Sem o bônus de pessoa física.
  expect(result.score).toBeLessThan(calculateDecisionMakerScore(input(), NOW).score);
});

test("sócio PJ sem representante legal diz isso, não inventa nome", () => {
  const result = calculateDecisionMakerScore(input({ memberType: "company" }), NOW);
  expect(result.reasons).toContain("Sócio pessoa jurídica — sem representante legal informado");
});

test("score fica sempre em 0..100", () => {
  const floor = calculateDecisionMakerScore(
    input({ role: "Estagiário", isCurrent: false, memberType: "foreign", startedAt: null }),
    NOW,
  );
  expect(floor.score).toBeGreaterThanOrEqual(0);
  const ceiling = calculateDecisionMakerScore(input(), NOW);
  expect(ceiling.score).toBeLessThanOrEqual(100);
});

test("Decision Score e Data Confidence são dimensões SEPARADAS", () => {
  // Mesmo cargo, mesma fonte, confiança diferente: o score não se move.
  const strong = calculateDecisionMakerScore(input({ confidence: 1 }), NOW);
  const weak = calculateDecisionMakerScore(input({ confidence: 0.5 }), NOW);
  expect(weak.score).toBe(strong.score);
  expect(weak.dataConfidence).toBe(0.5);
  expect(strong.dataConfidence).toBe(1);
});

test("tempo de sociedade curto não ganha o bônus de permanência", () => {
  const recent = calculateDecisionMakerScore(input({ startedAt: "2025-06-01" }), NOW);
  expect(recent.reasons.some((r) => r.includes("Na sociedade há"))).toBe(false);
});

test("data de entrada inválida não quebra nem inventa tempo", () => {
  const result = calculateDecisionMakerScore(input({ startedAt: "not-a-date" }), NOW);
  expect(Number.isFinite(result.score)).toBe(true);
  expect(result.reasons.some((r) => r.includes("Na sociedade há"))).toBe(false);
});

test("ordenação de abordagem: score, depois confiança, depois nome", () => {
  const people = [
    { name: "Carlos", score: 80, dataConfidence: 1 },
    { name: "Ana", score: 100, dataConfidence: 1 },
    { name: "Bruno", score: 80, dataConfidence: 0.5 },
  ];
  expect([...people].sort(compareDecisionMakers).map((p) => p.name)).toEqual([
    "Ana",
    "Carlos",
    "Bruno",
  ]);
});
