import { describe, expect, test } from "bun:test";
import { computeNba, leadToNbaInput } from "./nba";
import type { Lead } from "@/types";

const base = (o: Partial<Lead>): Lead => ({
  id: "1",
  companyName: "Test",
  category: "x",
  address: "",
  city: "POA",
  state: "RS",
  latitude: 0,
  longitude: 0,
  distanceKm: 1,
  hasWebsite: false,
  score: 80,
  temperature: "hot",
  stage: "new",
  discoveredAt: new Date().toISOString(),
  notes: [],
  activities: [],
  timeline: [],
  ...o,
});

describe("nba mapper (Fase 6 — thin adapter over the domain)", () => {
  test("contacted lead with a due cadence step maps the domain cadenceStepId back to the UI step", () => {
    const lead = base({
      stage: "contacted",
      whatsapp: "+5511999999999",
      cadenceStartedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      cadenceStep: 0,
      lastInteractionAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    });
    const nba = computeNba(lead);
    expect(nba.cadenceStep?.id).toBe("followup-1");
    expect(nba.channel).toBe("whatsapp");
    expect(nba.priority).toBe("high");
    expect(nba.cta).toBe("Preparar follow-up");
  });

  test("domain 'phone'/'none' channels map to legacy 'call'/'system'", () => {
    const phoneOnly = base({ phone: "+5551999999999", stage: "qualified" });
    expect(computeNba(phoneOnly).channel).toBe("call");
    const noChannel = base({});
    expect(computeNba(noChannel).channel).toBe("system");
  });

  test("won/discarded branches come from the domain (no local rules left)", () => {
    const won = base({ stage: "won" });
    expect(computeNba(won).action).toBe("Registrar próximos passos");
    expect(computeNba(won).priority).toBe("low");
    const discarded = base({ stage: "discarded" });
    expect(computeNba(discarded).action).toBe("Revisar motivo do descarte");
  });

  test("leadToNbaInput carries the CRM context the domain consumes", () => {
    const lead = base({
      stage: "contacted",
      cadenceStartedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      cadenceStep: 2,
      cadenceCompletedAt: new Date().toISOString(),
      lastInteractionAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      whatsapp: "+5511999999999",
    });
    const input = leadToNbaInput(lead);
    expect(input.crmStage).toBe("contacted");
    expect(input.cadenceStep).toBe(2);
    expect(input.cadenceCompleted).toBe(true);
    expect(input.cadenceStartedDays).toBe(5);
    expect(input.lastContactDays).toBe(5);
  });
});
