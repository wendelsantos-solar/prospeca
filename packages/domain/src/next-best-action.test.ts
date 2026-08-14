import { describe, expect, test } from "bun:test";
import {
  CADENCE_STEP_DEFS,
  recommendNextBestAction,
  type NextBestActionInput,
} from "./next-best-action";

const base: NextBestActionInput = {
  hasWebsite: false,
  hasEmail: false,
  hasPhone: false,
  whatsappStatus: "unknown",
  rating: null,
  reviewCount: null,
  temperature: "hot",
  score: 84,
};

const funnelLead: NextBestActionInput = {
  ...base,
  hasPhone: true,
  whatsappStatus: "verified",
  temperature: "warm",
};

describe("recommendNextBestAction", () => {
  test("prefers WhatsApp when validated", () => {
    const r = recommendNextBestAction({ ...base, whatsappStatus: "verified" });
    expect(r.channel).toBe("whatsapp");
  });

  test("falls back email → phone → none", () => {
    expect(recommendNextBestAction({ ...base, hasEmail: true }).channel).toBe("email");
    expect(recommendNextBestAction({ ...base, hasPhone: true }).channel).toBe("phone");
    expect(recommendNextBestAction(base).channel).toBe("none");
  });

  test("urgency follows temperature", () => {
    expect(recommendNextBestAction(base).urgency).toBe("high");
    expect(recommendNextBestAction({ ...base, temperature: "warm" }).urgency).toBe("medium");
    expect(recommendNextBestAction({ ...base, temperature: "cold" }).urgency).toBe("low");
  });

  test("reason lists opportunity signals", () => {
    const r = recommendNextBestAction({ ...base, rating: 4.6, reviewCount: 5, whatsappStatus: "verified" });
    expect(r.messageSignals).toContain("não possui site");
    expect(r.messageSignals).toContain("boa avaliação");
    expect(r.messageSignals).toContain("poucas avaliações");
    expect(r.reason).toContain("Oportunidade");
  });

  test("no signals → neutral reason", () => {
    const r = recommendNextBestAction({ ...base, hasWebsite: true, temperature: "cold" });
    expect(r.reason).toBe("Empresa dentro da missão de busca.");
  });
});

describe("recommendNextBestAction — funnel branches (migrated from web computeNba)", () => {
  test("won → system/low, registers next steps", () => {
    const r = recommendNextBestAction({ ...funnelLead, crmStage: "won" });
    expect(r.channel).toBe("system");
    expect(r.urgency).toBe("low");
    expect(r.recommendation).toBe("Registrar próximos passos");
    expect(r.ctaHint).toBe("Criar atividade");
  });

  test("discarded → system/low, review discard reason", () => {
    const r = recommendNextBestAction({ ...funnelLead, crmStage: "discarded" });
    expect(r.channel).toBe("system");
    expect(r.urgency).toBe("low");
    expect(r.recommendation).toBe("Revisar motivo do descarte");
  });

  test("no contact channel (funnel) → medium, enrich first", () => {
    const r = recommendNextBestAction({ ...base, crmStage: "new" });
    expect(r.channel).toBe("system");
    expect(r.urgency).toBe("medium");
    expect(r.recommendation).toBe("Buscar outro canal");
    expect(r.ctaHint).toBe("Editar dados");
  });

  test("new lead, never contacted → high urgency, first approach", () => {
    const r = recommendNextBestAction({ ...funnelLead, crmStage: "new", lastContactDays: null });
    expect(r.urgency).toBe("high");
    expect(r.channel).toBe("whatsapp");
    expect(r.recommendation).toBe("Enviar primeira abordagem");
    expect(r.ctaHint).toBe("Preparar abordagem");
  });

  test("new lead contacted <2 days ago → low, wait", () => {
    const r = recommendNextBestAction({ ...funnelLead, crmStage: "new", lastContactDays: 1 });
    expect(r.urgency).toBe("low");
    expect(r.recommendation).toBe("Aguardar retorno");
    expect(r.reason).toContain("1 dia");
  });

  test("contacted, cadence not started → confirm first contact", () => {
    const r = recommendNextBestAction({
      ...funnelLead,
      crmStage: "contacted",
      cadenceStartedDays: null,
      lastContactDays: 3,
    });
    expect(r.recommendation).toBe("Confirmar primeiro contato");
    expect(r.urgency).toBe("low");
  });

  test("contacted, next step NOT yet due → wait with upcoming hint", () => {
    const r = recommendNextBestAction({
      ...funnelLead,
      crmStage: "contacted",
      cadenceStartedDays: 1,
      cadenceStep: 0,
      lastContactDays: 1,
    });
    expect(r.recommendation).toBe("Aguardar resposta");
    expect(r.reason).toContain("Próximo toque");
    expect(r.urgency).toBe("low");
  });

  test("contacted, step due → cadence action with step id + high urgency", () => {
    const r = recommendNextBestAction({
      ...funnelLead,
      crmStage: "contacted",
      cadenceStartedDays: 3,
      cadenceStep: 0,
      lastContactDays: 3,
    });
    expect(r.cadenceStepId).toBe("followup-1");
    expect(r.channel).toBe("whatsapp");
    expect(r.urgency).toBe("high");
    expect(r.reason).toContain("toque 1 de 4");
    expect(r.ctaHint).toBe("Preparar follow-up");
  });

  test("contacted, call step due → call channel + Ligar agora", () => {
    const r = recommendNextBestAction({
      ...funnelLead,
      crmStage: "contacted",
      cadenceStartedDays: 5,
      cadenceStep: 1,
      lastContactDays: 5,
    });
    expect(r.cadenceStepId).toBe("call-1");
    expect(r.channel).toBe("call");
    expect(r.ctaHint).toBe("Ligar agora");
  });

  test("contacted, LAST step due → medium urgency (not high)", () => {
    const r = recommendNextBestAction({
      ...funnelLead,
      crmStage: "contacted",
      cadenceStartedDays: 15,
      cadenceStep: 3,
      lastContactDays: 15,
    });
    expect(r.cadenceStepId).toBe("last-attempt");
    expect(r.urgency).toBe("medium");
  });

  test("contacted, cadence completed → define next step", () => {
    const r = recommendNextBestAction({
      ...funnelLead,
      crmStage: "contacted",
      cadenceCompleted: true,
    });
    expect(r.recommendation).toBe("Definir próximo passo");
    expect(r.channel).toBe("system");
  });

  test("qualified → high, schedule meeting or proposal", () => {
    const r = recommendNextBestAction({ ...funnelLead, crmStage: "qualified" });
    expect(r.urgency).toBe("high");
    expect(r.recommendation).toBe("Agendar reunião ou enviar proposta");
    expect(r.ctaHint).toBe("Agendar reunião");
  });

  test("cadence defs are the single source (4 steps, alternating channels)", () => {
    expect(CADENCE_STEP_DEFS).toHaveLength(4);
    expect(CADENCE_STEP_DEFS.map((s) => s.id)).toEqual([
      "followup-1",
      "call-1",
      "followup-2",
      "last-attempt",
    ]);
    expect(CADENCE_STEP_DEFS.map((s) => s.dueAtDay)).toEqual([2, 4, 7, 14]);
  });

  test("legacy contract unchanged: no crmStage → channels + signals behavior", () => {
    const r = recommendNextBestAction({
      ...base,
      hasWebsite: true,
      whatsappStatus: "verified",
    });
    expect(r.channel).toBe("whatsapp");
    expect(r.recommendation).toContain("WhatsApp");
    expect(r.cadenceStepId).toBeUndefined();
    expect(r.ctaHint).toBeUndefined();
  });

  test("V3-C contextual: NO_WEBSITE → website-oriented recommendation", () => {
    const r = recommendNextBestAction({ ...base, whatsappStatus: "verified" }); // hasWebsite: false
    expect(r.recommendation).toBe("Oferecer criação de website");
    expect(r.channel).toBe("whatsapp"); // channel logic untouched
  });

  test("V3-C contextual: WEAK_REPUTATION → reputation diagnostic (with site)", () => {
    const r = recommendNextBestAction({
      ...base,
      hasWebsite: true,
      rating: 2.8,
      reviewCount: 5,
      whatsappStatus: "verified",
    });
    expect(r.recommendation).toBe("Enviar diagnóstico de reputação");
    expect(r.messageSignals).toContain("poucas avaliações");
  });

  test("V3-C contextual: funnel branches are preserved (no contextual override)", () => {
    const won = recommendNextBestAction({ ...funnelLead, crmStage: "won" });
    expect(won.recommendation).toBe("Registrar próximos passos");
    const cadence = recommendNextBestAction({
      ...funnelLead,
      crmStage: "contacted",
      cadenceStartedDays: 3,
      cadenceStep: 0,
      lastContactDays: 3,
    });
    expect(cadence.cadenceStepId).toBe("followup-1");
    expect(cadence.recommendation).toBe("Follow-up curto");
  });
});
