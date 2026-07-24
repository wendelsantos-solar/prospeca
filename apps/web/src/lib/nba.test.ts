import { test, expect } from "bun:test";
import { computeNba } from "./nba";
import type { Lead } from "@/types";

const base = (o: Partial<Lead>): Lead => ({
  id: "1", companyName: "X", category: "c", address: "", city: "", state: "",
  latitude: 0, longitude: 0, distanceKm: 0, hasWebsite: false, score: 50,
  temperature: "warm", stage: "new", discoveredAt: new Date().toISOString(),
  notes: [], activities: [], timeline: [], ...o,
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
test("contacted with whatsapp, 3 days since interaction → high/whatsapp", () => {
  const n = computeNba(base({
    stage: "contacted",
    whatsapp: "551199",
    lastInteractionAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  }));
  expect(n.priority).toBe("high");
  expect(n.channel).toBe("whatsapp");
});
