import { beforeEach, describe, expect, test } from "bun:test";
import type { DiscoveryResult } from "@/repositories/types";
import { useLeadsStore } from "./index";
import { EMPTY_ACTIVATION_MILESTONES, useActivationStore } from "./activation";

const preview: DiscoveryResult = {
  placeId: "place-1",
  name: "Barbearia Central",
  category: "barber_shop",
  latitude: -22.9,
  longitude: -43.1,
  address: null,
  neighborhood: null,
  city: "Rio de Janeiro",
  state: "RJ",
  phone: "5521999999999",
  website: null,
  hasWebsite: false,
  email: null,
  instagram: null,
  whatsapp: "5521999999999",
  rating: 4.8,
  reviewCount: 24,
  distanceKm: 2.3,
  score: 83,
  temperature: "hot",
  importedLeadId: null,
  enrichmentState: "enriched",
  enrichmentFields: null,
  primaryCnae: null,
  cnaeDescription: null,
  secondaryCnaes: null,
};

beforeEach(() => {
  useActivationStore.setState({
    milestones: { ...EMPTY_ACTIVATION_MILESTONES },
    hydrated: true,
    persist: null,
  });
  useLeadsStore.setState({ detailsId: null, preview: null });
});

describe("ativação ao abrir detalhes", () => {
  test("abrir um lead já no pipeline conclui firstLeadViewed", () => {
    useLeadsStore.getState().setDetails("lead-1");

    expect(useActivationStore.getState().milestones.firstLeadViewed).toBe(true);
  });

  test("abrir a prévia de uma descoberta conclui firstLeadViewed", () => {
    useLeadsStore.getState().setPreview(preview);

    expect(useActivationStore.getState().milestones.firstLeadViewed).toBe(true);
  });

  test("fechar detalhes não altera o marco", () => {
    useLeadsStore.getState().setDetails(null);

    expect(useActivationStore.getState().milestones.firstLeadViewed).toBe(false);
  });
});
