import { describe, it, expect } from "bun:test";
import { buildDiagnosticReport, diagnosticReason } from "./diagnostic-report";
import type { Lead } from "@/types";

const base = (o: Partial<Lead>): Lead => ({
  id: "1",
  companyName: "Padaria Pão Dourado",
  category: "bakery",
  address: "Rua das Flores, 100",
  neighborhood: "Centro",
  city: "Porto Alegre",
  state: "RS",
  latitude: -30,
  longitude: -51,
  distanceKm: 1.2,
  phone: "+55 51 99999-0000",
  hasWebsite: false,
  score: 82,
  scoreBreakdown: {
    ruleVersion: "v3.0.0",
    total: 82,
    items: [{ key: "no_website", label: "Sem site", points: 30, reason: "Sem presença digital" }],
  },
  temperature: "hot",
  stage: "new",
  discoveredAt: new Date().toISOString(),
  notes: [],
  activities: [],
  timeline: [],
  ...o,
});

describe("buildDiagnosticReport", () => {
  it("derives grounded gaps from real signals only", () => {
    const r = buildDiagnosticReport(base({ hasWebsite: false, rating: 3.1, reviewCount: 0 }));
    expect(r.gaps).toContain("não tem site próprio");
    expect(r.gaps).toContain("tem nota 3.1 (abaixo de 4,0)");
    expect(r.gaps).toContain("não tem nenhuma avaliação online");
  });

  it("never invents a gap for a mature lead", () => {
    const r = buildDiagnosticReport(
      base({ hasWebsite: true, rating: 4.8, reviewCount: 120, instagram: "@pao", whatsapp: "51" }),
    );
    expect(r.gaps).toEqual(["presença digital já relativamente completa"]);
    expect(r.gaps.some((g) => g.includes("site"))).toBe(false);
  });

  it("marks presence checklist status correctly", () => {
    const r = buildDiagnosticReport(base({ hasWebsite: false }));
    const site = r.presence.find((p) => p.label === "Site");
    expect(site?.status).toBe("gap");
    expect(site?.detail).toBe("Sem site próprio");
  });

  it("white-labels with branding and fills the opener with real vars", () => {
    const r = buildDiagnosticReport(base({}), {
      branding: { authorName: "Ana", companyName: "Agência Nova" },
      template:
        "Olá, sou {{meu_nome}} da {{minha_empresa}}. Vi a {{empresa}} e notei que {{razao_contato}}.",
    });
    expect(r.brand.companyName).toBe("Agência Nova");
    expect(r.message).toContain("Padaria Pão Dourado");
    expect(r.message).toContain("não tem site próprio"); // {{razao_contato}}
    expect(r.message).toContain("Ana"); // {{meu_nome}}
    expect(r.message).toContain("Agência Nova"); // {{minha_empresa}}
  });

  it("falls back to neutral branding when none provided", () => {
    const r = buildDiagnosticReport(base({}));
    expect(r.brand.companyName).toBe("Prospeca");
    expect(r.brand.authorName).toBe("Seu consultor");
  });

  it("exposes a next-best-action grounded in the lead stage", () => {
    const r = buildDiagnosticReport(base({ stage: "new" }));
    expect(r.nextAction.action.length).toBeGreaterThan(0);
    expect(r.nextAction.reason.length).toBeGreaterThan(0);
  });
});

describe("diagnosticReason", () => {
  it("returns the primary grounded contact reason", () => {
    expect(diagnosticReason(base({ hasWebsite: false }))).toBe("não tem site próprio");
    expect(diagnosticReason(base({ hasWebsite: true, rating: 3.0 }))).toContain("abaixo da média");
    expect(diagnosticReason(base({ hasWebsite: true, reviewCount: 0 }))).toBe(
      "não tem avaliações online",
    );
  });
});
