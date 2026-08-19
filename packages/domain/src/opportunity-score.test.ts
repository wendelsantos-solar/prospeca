import { describe, expect, test } from "bun:test";
import {
  calculateOpportunityScore,
  confidenceBandFromConfidence,
  CONFIDENCE_BANDS,
  deriveOpportunityScoreState,
  OPPORTUNITY_SCORE_WEIGHTS,
  opportunityTemperatureFromScore,
  type OpportunityScoreInput,
} from "./opportunity-score";
import { deriveSignals } from "./signals";

function input(overrides: Partial<OpportunityScoreInput> = {}): OpportunityScoreInput {
  return {
    signals: deriveSignals({
      hasWebsite: false,
      hasValidPhone: false,
      whatsappStatus: "unknown",
      hasEmail: false,
      rating: null,
      reviewCount: null,
      businessStatus: null,
    }),
    rating: null,
    reviewCount: null,
    hasWebsite: false,
    whatsappStatus: "unknown",
    ...overrides,
  };
}

describe("calculateOpportunityScore", () => {
  test("total stays within 0..100 for extremes", () => {
    const rich = calculateOpportunityScore(
      input({
        signals: deriveSignals({
          hasWebsite: true,
          hasValidPhone: true,
          whatsappStatus: "verified",
          hasEmail: true,
          rating: 4.9,
          reviewCount: 200,
          businessStatus: "OPERATIONAL",
        }),
        rating: 4.9,
        reviewCount: 200,
        hasWebsite: true,
        whatsappStatus: "verified",
        intentMatch: 1,
        territoryFavorability: 1,
        freshnessDays: 1,
      }),
    );
    expect(rich.total).toBeGreaterThanOrEqual(0);
    expect(rich.total).toBeLessThanOrEqual(100);
  });

  test("weights sum to 1", () => {
    const sum = Object.values(OPPORTUNITY_SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(Math.round(sum * 100) / 100).toBe(1);
  });

  test("points sum equals total", () => {
    const result = calculateOpportunityScore(
      input({ rating: 4.5, reviewCount: 30, intentMatch: 0.7, freshnessDays: 5 }),
    );
    const points = result.components.reduce((a, c) => a + c.points, 0);
    expect(result.total).toBe(points);
  });

  test("digital gap drives the score up for a no-website business", () => {
    const noSite = calculateOpportunityScore(input({ hasWebsite: false }));
    const withSite = calculateOpportunityScore(input({ hasWebsite: true }));
    const gapNoSite = noSite.components.find((c) => c.key === "digital_gap")!.score;
    const gapWithSite = withSite.components.find((c) => c.key === "digital_gap")!.score;
    expect(gapNoSite).toBeGreaterThan(gapWithSite);
  });

  test("per-org intent match changes the total (same company, different org)", () => {
    const high = calculateOpportunityScore(input({ intentMatch: 1 }));
    const low = calculateOpportunityScore(input({ intentMatch: 0 }));
    expect(high.total).toBeGreaterThan(low.total);
  });

  test("confidence grows with more observed dimensions", () => {
    const sparse = calculateOpportunityScore(input({}));
    const rich = calculateOpportunityScore(
      input({
        rating: 4.5,
        reviewCount: 30,
        intentMatch: 0.8,
        territoryFavorability: 0.6,
        freshnessDays: 2,
      }),
    );
    expect(rich.confidence).toBeGreaterThan(sparse.confidence);
  });

  test("version and confidence are present", () => {
    const result = calculateOpportunityScore(input());
    // Versão é contrato: muda quando a fórmula muda (v1.3.0 = decisor entra na
    // contatabilidade). O teste trava o valor de propósito — bumpar sem
    // perceber mudaria a ORDEM dos leads em silêncio.
    expect(result.version).toBe("v1.3.0");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.components.length).toBe(Object.keys(OPPORTUNITY_SCORE_WEIGHTS).length);
  });

  test("breakdown carries the confidence band", () => {
    const sparse = calculateOpportunityScore(input({}));
    expect(sparse.confidenceBand).toBe("low"); // floor 0.6, nothing observed
    const rich = calculateOpportunityScore(
      input({ rating: 4.5, reviewCount: 30, intentMatch: 0.8, territoryFavorability: 0.6 }),
    );
    expect(rich.confidenceBand).toBe("high"); // 4 observed → 0.92
  });
});

describe("deriveOpportunityScoreState (V3-C)", () => {
  test("no website source finished → ANALISANDO", () => {
    expect(deriveOpportunityScoreState({ websiteState: null })).toBe("ANALISANDO");
    expect(deriveOpportunityScoreState({ websiteState: "pending" })).toBe("ANALISANDO");
    expect(deriveOpportunityScoreState({ websiteState: "processing" })).toBe("ANALISANDO");
  });
  test("website enriched + no registry consulted → FINALIZADO (registry is on-demand)", () => {
    expect(deriveOpportunityScoreState({ websiteState: "enriched" })).toBe("FINALIZADO");
    expect(
      deriveOpportunityScoreState({ websiteState: "partial", registryState: "enriched" }),
    ).toBe("FINALIZADO");
  });
  test("website failed → PARCIAL (automatic source errored)", () => {
    expect(deriveOpportunityScoreState({ websiteState: "failed" })).toBe("PARCIAL");
  });
  test("website fine but registry failed → PARCIAL (consulted source errored)", () => {
    expect(deriveOpportunityScoreState({ websiteState: "enriched", registryState: "failed" })).toBe(
      "PARCIAL",
    );
  });
  test("breakdown persists scoreState (v1.2.0)", () => {
    const analyzing = calculateOpportunityScore(input({}));
    expect(analyzing.scoreState).toBe("ANALISANDO");
    const done = calculateOpportunityScore(input({ websiteState: "enriched" }));
    expect(done.scoreState).toBe("FINALIZADO");
    const partial = calculateOpportunityScore(input({ websiteState: "failed" }));
    expect(partial.scoreState).toBe("PARCIAL");
  });
});

describe("confidenceBandFromConfidence", () => {
  test("band thresholds: LOW < 0.70 · MEDIUM 0.70–0.84 · HIGH ≥ 0.85", () => {
    expect(confidenceBandFromConfidence(0.699)).toBe("low");
    expect(confidenceBandFromConfidence(CONFIDENCE_BANDS.lowMax)).toBe("medium");
    expect(confidenceBandFromConfidence(0.849)).toBe("medium");
    expect(confidenceBandFromConfidence(CONFIDENCE_BANDS.highMin)).toBe("high");
    expect(confidenceBandFromConfidence(1)).toBe("high");
  });
  test("clamps out-of-range values to the nearest band", () => {
    expect(confidenceBandFromConfidence(0)).toBe("low");
    expect(confidenceBandFromConfidence(1.5)).toBe("high");
  });
});

describe("opportunityTemperatureFromScore", () => {
  test("reuses canonical bands", () => {
    expect(opportunityTemperatureFromScore(84)).toBe("hot");
    expect(opportunityTemperatureFromScore(70)).toBe("warm");
    expect(opportunityTemperatureFromScore(40)).toBe("cold");
  });
});

describe("fonte única (Fase 3 — unificação de score)", () => {
  test("a mesma entrada produz o MESMO score em qualquer chamada (descoberta e funil leem o mesmo número)", () => {
    // A sincronia lead/descoberta se apoia no fato de o V2 ser função pura dos
    // inputs: score-company grava search_results, company_opportunity_scores e
    // leads.score com o MESMO calculateOpportunityScore — e o fallback do
    // cliente (useCompanyIntelligence) deriva do mesmo domínio.
    const a = calculateOpportunityScore(
      input({ rating: 4.6, reviewCount: 120, hasWebsite: false, intentMatch: 0.8 }),
    );
    const b = calculateOpportunityScore(
      input({ rating: 4.6, reviewCount: 120, hasWebsite: false, intentMatch: 0.8 }),
    );
    expect(a.total).toBe(b.total);
    expect(a.components).toEqual(b.components);
    expect(a.confidence).toBe(b.confidence);
    expect(a.total).toBeGreaterThan(0);
  });

  test("a temperatura deriva do MESMO total persistido (nenhuma segunda fórmula)", () => {
    // O breakdown não carrega temperatura — score-company a deriva do total
    // via opportunityTemperatureFromScore e persiste nos três lugares.
    const s = calculateOpportunityScore(input({ hasWebsite: false }));
    expect(opportunityTemperatureFromScore(s.total)).toBe(opportunityTemperatureFromScore(s.total));
    expect(["hot", "warm", "cold"]).toContain(opportunityTemperatureFromScore(s.total));
  });
});

// ── Decisor na contatabilidade (v1.3.0) ─────────────────────────────────────
//
// Até v1.2.0 uma empresa pontuava igual tendo ou não uma pessoa nomeada para
// procurar. Contatabilidade não é "tenho um número", é "consigo chegar em quem
// decide" — e sem essa parcela toda a People Intelligence não movia a fila.

describe("decisor na contatabilidade", () => {
  const comCanais = (extra: Partial<OpportunityScoreInput> = {}): OpportunityScoreInput => ({
    signals: ["VALID_PHONE", "WHATSAPP_AVAILABLE"],
    rating: 4,
    reviewCount: 30,
    hasWebsite: true,
    whatsappStatus: "possible",
    ...extra,
  });

  const contactability = (i: OpportunityScoreInput) =>
    calculateOpportunityScore(i).components.find((c) => c.key === "contactability")!;

  test("decisor de banda alta sobe a contatabilidade", () => {
    const sem = contactability(comCanais());
    const com = contactability(
      comCanais({
        signals: [
          "VALID_PHONE",
          "WHATSAPP_AVAILABLE",
          "DECISION_MAKER_IDENTIFIED",
          "DECISION_MAKER_HIGH",
        ],
      }),
    );
    expect(com.score).toBeGreaterThan(sem.score);
    expect(com.reason).toContain("Decisor identificado");
  });

  test("decisor de banda média vale menos que o de banda alta", () => {
    const medio = contactability(
      comCanais({ signals: ["VALID_PHONE", "DECISION_MAKER_IDENTIFIED"] }),
    );
    const alto = contactability(
      comCanais({ signals: ["VALID_PHONE", "DECISION_MAKER_IDENTIFIED", "DECISION_MAKER_HIGH"] }),
    );
    expect(alto.score).toBeGreaterThan(medio.score);
  });

  test("empresa SEM decisor não perde nada (a mudança é só aditiva)", () => {
    // Os pesos entre componentes não mudaram; a parcela entra dentro de
    // contactability. Quem não tem decisor pontua igual a antes.
    const semDecisor = comCanais();
    const c = contactability(semDecisor);
    expect(c.score).toBe(35 + 30); // VALID_PHONE + WHATSAPP_AVAILABLE, como em v1.2.0
  });

  test("decisor eleva o score TOTAL — é uma mudança de ordem deliberada", () => {
    const sem = calculateOpportunityScore(comCanais()).total;
    const com = calculateOpportunityScore(
      comCanais({
        signals: [
          "VALID_PHONE",
          "WHATSAPP_AVAILABLE",
          "DECISION_MAKER_IDENTIFIED",
          "DECISION_MAKER_HIGH",
        ],
      }),
    ).total;
    expect(com).toBeGreaterThan(sem);
  });

  test("consultei e não há decisor ≠ nunca consultei — só a CONFIANÇA muda", () => {
    const nuncaConsultei = calculateOpportunityScore(comCanais());
    const consulteiSemDecisor = calculateOpportunityScore(comCanais({ decisionMakerCount: 0 }));
    // Pontuação idêntica: zero decisores não penaliza a empresa.
    expect(consulteiSemDecisor.total).toBe(nuncaConsultei.total);
    // Mas o registro respondeu — isso é uma dimensão observada a mais.
    expect(consulteiSemDecisor.confidence).toBeGreaterThan(nuncaConsultei.confidence);
  });

  test("os pesos entre componentes continuam intactos", () => {
    expect(OPPORTUNITY_SCORE_WEIGHTS.contactability).toBe(0.2);
    expect(OPPORTUNITY_SCORE_WEIGHTS.digital_gap).toBe(0.3);
  });
});
