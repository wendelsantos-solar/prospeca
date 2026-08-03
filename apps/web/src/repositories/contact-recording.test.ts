import { expect, test } from "bun:test";
import { DemoLeadRepository, seedDemoLeads } from "./demo";
import type { Lead } from "@/types";

const lead: Lead = {
  id: "lead-1",
  companyName: "Clínica Horizonte",
  category: "clinic",
  address: "",
  city: "Curitiba",
  state: "PR",
  latitude: 0,
  longitude: 0,
  distanceKm: 0,
  hasWebsite: false,
  score: 70,
  temperature: "warm",
  stage: "new",
  cadenceStep: 0,
  discoveredAt: "2026-08-01T10:00:00.000Z",
  notes: [],
  activities: [],
  timeline: [],
};

test("recordContact inicia a cadência apenas quando o envio é confirmado", async () => {
  seedDemoLeads([lead]);
  const repository = new DemoLeadRepository();

  const recorded = await repository.recordContact("lead-1", {
    channel: "whatsapp",
    title: "Primeiro contato enviado",
    outcome: "sent",
    occurredAt: "2026-08-01T12:00:00.000Z",
  });
  const updated = await repository.getById("lead-1");

  expect(recorded.done).toBe(true);
  expect(recorded.outcome).toBe("sent");
  expect(updated?.stage).toBe("contacted");
  expect(updated?.cadenceStartedAt).toBe("2026-08-01T12:00:00.000Z");
  expect(updated?.cadenceStep).toBe(0);
  expect(updated?.lastInteractionAt).toBe("2026-08-01T12:00:00.000Z");
});

test("recordContact avança uma etapa explícita sem reiniciar a cadência", async () => {
  seedDemoLeads([
    {
      ...lead,
      stage: "contacted",
      cadenceStartedAt: "2026-08-01T12:00:00.000Z",
      lastInteractionAt: "2026-08-01T12:00:00.000Z",
    },
  ]);
  const repository = new DemoLeadRepository();

  await repository.recordContact("lead-1", {
    channel: "whatsapp",
    title: "Follow-up curto enviado",
    outcome: "sent",
    cadenceStepId: "followup-1",
    occurredAt: "2026-08-03T12:00:00.000Z",
  });
  const updated = await repository.getById("lead-1");

  expect(updated?.cadenceStartedAt).toBe("2026-08-01T12:00:00.000Z");
  expect(updated?.cadenceStep).toBe(1);
  expect(updated?.lastInteractionAt).toBe("2026-08-03T12:00:00.000Z");
  expect(updated?.activities[0]?.cadenceStepId).toBe("followup-1");
});

test("recordContact encerra a cadência quando há resposta", async () => {
  seedDemoLeads([
    {
      ...lead,
      stage: "contacted",
      cadenceStartedAt: "2026-08-01T12:00:00.000Z",
      lastInteractionAt: "2026-08-01T12:00:00.000Z",
    },
  ]);
  const repository = new DemoLeadRepository();

  await repository.recordContact("lead-1", {
    channel: "whatsapp",
    title: "Resposta recebida",
    outcome: "answered",
    occurredAt: "2026-08-02T12:00:00.000Z",
  });

  const updated = await repository.getById("lead-1");
  expect(updated?.cadenceCompletedAt).toBe("2026-08-02T12:00:00.000Z");
  expect(updated?.lastOutcome).toBe("answered");
  expect(updated?.respondedAt).toBe("2026-08-02T12:00:00.000Z");
});
