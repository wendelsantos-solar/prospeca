import { describe, expect, test } from "bun:test";
import { mergeOnboardingProgress, type OnboardingProgress } from "./account";

const base: OnboardingProgress = {
  step: 1,
  completed: false,
  skippedSteps: [],
  searchDraft: {
    niche: "Barbearia",
    presence: "no-website",
    location: "Sorocaba, São Paulo",
    latitude: -23.5,
    longitude: -47.4,
    radiusKm: 10,
  },
  milestones: {
    firstSearch: true,
    firstLeadViewed: false,
    firstLeadAdded: false,
    firstMessagePrepared: false,
  },
};

describe("mergeOnboardingProgress", () => {
  test("preserva busca e marcos já concluídos em atualizações parciais", () => {
    const merged = mergeOnboardingProgress(base, {
      step: 2,
      completed: true,
      skippedSteps: [],
      milestones: {
        firstSearch: false,
        firstLeadViewed: true,
        firstLeadAdded: false,
        firstMessagePrepared: false,
      },
    });

    expect(merged.searchDraft).toEqual(base.searchDraft);
    expect(merged.milestones).toEqual({
      firstSearch: true,
      firstLeadViewed: true,
      firstLeadAdded: false,
      firstMessagePrepared: false,
    });
  });

  test("inicializa todos os marcos para um novo usuário", () => {
    const merged = mergeOnboardingProgress(null, {
      step: 0,
      completed: false,
      skippedSteps: [],
    });

    expect(merged.milestones).toEqual({
      firstSearch: false,
      firstLeadViewed: false,
      firstLeadAdded: false,
      firstMessagePrepared: false,
    });
  });
});
