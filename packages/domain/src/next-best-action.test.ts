import { describe, expect, test } from "bun:test";
import { recommendNextBestAction, type NextBestActionInput } from "./next-best-action";

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
