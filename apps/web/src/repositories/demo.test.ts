// P2 da 4d (demo): seedDemoLeads substituía demoLeads pelo conteúdo do store —
// com a paginação da Fase 4 o store passou a conter UMA PÁGINA (50 de 82) e o
// seed apagava leads fora da página + revertia mutações locais. Estes testes
// provam os 3 sintomas resolvidos pela MESCLAGEM POR ID.

import { beforeEach, describe, expect, test } from "bun:test";
import { seedDemoLeads, resetDemoLeads, DemoLeadRepository } from "./demo";
import { MOCK_LEADS } from "@/mocks/leads";
import type { Lead } from "@/types";

const repo = new DemoLeadRepository();

function cloneLead(l: Lead): Lead {
  return JSON.parse(JSON.stringify(l)) as Lead;
}

beforeEach(() => {
  // Estado limpo e determinístico a cada teste.
  resetDemoLeads(MOCK_LEADS.map(cloneLead));
});

describe("seedDemoLeads (merge por id — sintomas da 4d)", () => {
  test("1. getById acha lead FORA da página atual após seed parcial", async () => {
    expect(MOCK_LEADS.length).toBeGreaterThan(50);
    const outsidePage = MOCK_LEADS[60];
    // Seed de UMA página (os 50 primeiros) — o lead 60 não está nela.
    seedDemoLeads(MOCK_LEADS.slice(0, 50).map(cloneLead));

    const found = await repo.getById(outsidePage.id);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(outsidePage.id);
  });

  test("2. move de estágio PERSISTE após re-seed (mutação local vence)", async () => {
    const target = cloneLead(MOCK_LEADS[0]);
    await repo.moveStage(target.id, { toStage: "qualified" });

    // Re-seed com o estado ANTIGO (stage original) — não pode reverter.
    seedDemoLeads([target]);

    const after = await repo.getById(target.id);
    expect(after?.stage).toBe("qualified");
  });

  test("3. lead ADICIONADO sobrevive ao re-seed de página parcial (e entra nos contadores)", async () => {
    const added = cloneLead(MOCK_LEADS[0]);
    added.id = `demo-added-${Math.random().toString(36).slice(2, 10)}`;
    added.companyName = "Lead adicionado 4d";
    seedDemoLeads([added]);

    // Re-seed com página parcial que NÃO contém o novo lead.
    seedDemoLeads(MOCK_LEADS.slice(0, 50).map(cloneLead));

    const found = await repo.getById(added.id);
    expect(found?.id).toBe(added.id);

    const counts = await repo.stageCounts();
    expect(counts.total).toBe(MOCK_LEADS.length + 1);
  });

  test("ids NOVOS do seed são incorporados (upsert real, não só preservação)", async () => {
    const fresh = cloneLead(MOCK_LEADS[1]);
    fresh.id = `demo-fresh-${Math.random().toString(36).slice(2, 10)}`;
    seedDemoLeads([fresh]);
    const found = await repo.getById(fresh.id);
    expect(found?.companyName).toBe(fresh.companyName);
  });
});
