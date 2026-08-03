import { test, expect } from "bun:test";
import { computeNba } from "./nba";
import type { Lead } from "@/types";

const base = (o: Partial<Lead>): Lead => ({
  id: "1",
  companyName: "X",
  category: "c",
  address: "",
  city: "",
  state: "",
  latitude: 0,
  longitude: 0,
  distanceKm: 0,
  hasWebsite: false,
  score: 50,
  temperature: "warm",
  stage: "new",
  discoveredAt: new Date().toISOString(),
  notes: [],
  activities: [],
  timeline: [],
  ...o,
});

test("new lead with whatsapp, never contacted → high/whatsapp", () => {
  const n = computeNba(base({ stage: "new", whatsapp: "551199" }));
  expect(n.priority).toBe("high");
  expect(n.channel).toBe("whatsapp");
});
test("won → low/system", () => {
  expect(computeNba(base({ stage: "won" })).priority).toBe("low");
});
test("no channels → medium/system", () => {
  const n = computeNba(base({ stage: "new" }));
  expect(n.channel).toBe("system");
  expect(n.priority).toBe("medium");
});
test("contacted with whatsapp and confirmed cadence due → high/whatsapp", () => {
  const startedAt = new Date(Date.now() - 3 * 86400000).toISOString();
  const n = computeNba(
    base({
      stage: "contacted",
      whatsapp: "551199",
      lastInteractionAt: startedAt,
      cadenceStartedAt: startedAt,
      cadenceStep: 0,
    }),
  );
  expect(n.priority).toBe("high");
  expect(n.channel).toBe("whatsapp");
  expect(n.cadenceStep?.order).toBe(1);
});

test("contacted without confirmed cadence anchor does not invent a follow-up", () => {
  const n = computeNba(base({ stage: "contacted", whatsapp: "551199" }));
  expect(n.channel).toBe("system");
  expect(n.cadenceStep).toBeUndefined();
});

test("completed cadence asks for a deliberate next step", () => {
  const n = computeNba(
    base({
      stage: "contacted",
      whatsapp: "551199",
      cadenceStartedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      cadenceStep: 4,
      cadenceCompletedAt: new Date().toISOString(),
    }),
  );
  expect(n.channel).toBe("system");
  expect(n.action).toBe("Definir próximo passo");
});
