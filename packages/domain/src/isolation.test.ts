// Cross-tenant isolation test scenarios.
// Validates that the domain-level entitlement functions correctly isolate
// organizations from each other. RLS database tests require a running
// Supabase instance (documented below as test plan).
//
// Run: bun test

import { describe, expect, test } from "bun:test";
import {
  hasFeature,
  remaining,
  canConsume,
  type PlanEntitlements,
  type FeatureKey,
  type UsageMetric,
} from "./entitlements";

// ── Entitlement isolation ────────────────────────────────────────────

function makePlan(
  features: Partial<Record<FeatureKey, boolean>>,
  limits: Partial<Record<UsageMetric, number>>,
): PlanEntitlements {
  return {
    features: features as Record<FeatureKey, boolean>,
    limits: limits as Record<UsageMetric, number>,
  };
}

describe("entitlement isolation", () => {
  const planA = makePlan(
    { lead_search: true, advanced_filters: true, csv_export: true },
    { searchesPerMonth: 200, processedLeadsPerMonth: 2000 },
  );

  const planB = makePlan(
    { lead_search: true, advanced_filters: false, csv_export: true },
    { searchesPerMonth: 2, processedLeadsPerMonth: 50 },
  );

  test("org A cannot consume org B's quota", () => {
    const usageA = { searchesPerMonth: 150, processedLeadsPerMonth: 500 };
    const usageB = { searchesPerMonth: 1, processedLeadsPerMonth: 10 };

    // Org A checks its own remaining
    const remainingA = remaining(planA, usageA, "searchesPerMonth");
    expect(remainingA).toBe(50); // 200 - 150

    // Org B checks its own remaining (independent)
    const remainingB = remaining(planB, usageB, "searchesPerMonth");
    expect(remainingB).toBe(1); // 2 - 1

    // Org A can consume more within its own limit
    expect(canConsume(planA, usageA, "searchesPerMonth", 1)).toBe(true);

    // Org B can still consume 1 within its own limit
    expect(canConsume(planB, usageB, "searchesPerMonth", 1)).toBe(true);

    // Org B hits its limit with 2 — uses OWN usage, not A's
    expect(canConsume(planB, usageB, "searchesPerMonth", 2)).toBe(false);
  });

  test("feature access is per-plan, not shared", () => {
    expect(hasFeature(planA, "advanced_filters")).toBe(true);
    expect(hasFeature(planB, "advanced_filters")).toBe(false);
  });

  test("remaining() computes per-plan limits correctly", () => {
    expect(remaining(planA, { processedLeadsPerMonth: 500 }, "processedLeadsPerMonth")).toBe(1500);
    expect(remaining(planB, { processedLeadsPerMonth: 10 }, "processedLeadsPerMonth")).toBe(40);
  });
});

// ── Data isolation test plan (for Supabase RLS testing) ──────────────
// These scenarios must pass in a running Supabase instance with two orgs.

export const ISOLATION_TEST_PLAN = {
  scenarios: [
    {
      id: "ISO-001",
      desc: "Usuário A não lê lead da Organização B",
      expected: "0 rows (RLS bloqueia)",
    },
    {
      id: "ISO-002",
      desc: "Usuário A não atualiza lead da Organização B",
      expected: "0 rows affected",
    },
    {
      id: "ISO-003",
      desc: "Usuário A não exclui busca da Organização B",
      expected: "0 rows affected",
    },
    {
      id: "ISO-004",
      desc: "Usuário A não acessa atividade da Organização B",
      expected: "0 rows",
    },
    {
      id: "ISO-005",
      desc: "Usuário A não exporta dados da Organização B",
      expected: "403 FORBIDDEN",
    },
    {
      id: "ISO-006",
      desc: "Usuário sem membership recebe 403",
      expected: "403 FORBIDDEN",
    },
    {
      id: "ISO-007",
      desc: "Usuário A não usa convite de outra Organização",
      expected: "FORBIDDEN (email mismatch)",
    },
    {
      id: "ISO-008",
      desc: "Acesso direto por UUID previsível é bloqueado",
      expected: "null (RLS scopes to org)",
    },
  ],
  rpcTests: [
    {
      function: "move_lead_stage",
      desc: "RPC valida membership inline antes do UPDATE",
      expected: "FORBIDDEN se organization_id != caller org",
    },
    {
      function: "get_dashboard_overview",
      desc: "RPC valida membership antes de retornar métricas",
      expected: "FORBIDDEN se organization_id != caller org",
    },
  ],
};
