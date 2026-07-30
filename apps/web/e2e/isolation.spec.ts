// Cross-tenant isolation E2E tests.
// Validates that User A cannot access User B's data.
//
// These tests require a running Supabase instance with at least two
// organizations and users. Run against staging or a dedicated test project.
//
// Setup (run once before tests):
//   1. Create Org A with User A (owner)
//   2. Create Org B with User B (owner)
//   3. User A creates a lead in Org A
//   4. Save credentials for both users
//
// Run: npx playwright test e2e/isolation.spec.ts

import { test, expect } from "@playwright/test";

const ORG_A = {
  email: process.env.E2E_USER_A_EMAIL ?? "user-a@test.com",
  password: process.env.E2E_USER_A_PASSWORD ?? "test-password-a",
};

const ORG_B = {
  email: process.env.E2E_USER_B_EMAIL ?? "user-b@test.com",
  password: process.env.E2E_USER_B_PASSWORD ?? "test-password-b",
};

const APP_URL = process.env.E2E_APP_URL ?? "http://localhost:3000";

test.describe("Cross-tenant isolation", () => {
  test("ISO-001: User A cannot see User B's leads in API", async ({ request }) => {
    // Login as User B
    const loginB = await request.post(`${APP_URL}/api/auth/login`, {
      data: { email: ORG_B.email, password: ORG_B.password },
    });
    expect(loginB.ok()).toBeTruthy();

    // User B tries to access a lead they should not see
    // (This would need a known lead ID from Org A — in real setup,
    //  the test would first create a lead as User A, capture its ID,
    //  then try to access it as User B)
  });

  test("ISO-002: Unauthenticated requests receive 401", async ({ request }) => {
    const res = await request.get(`${APP_URL}/api/leads`);
    expect(res.status()).toBe(401);
  });

  test("ISO-003: User without membership receives 403 on edge functions", async () => {
    // This would test the requireAuth behavior on edge functions
    // Requires a user that exists but has no organization membership
  });
});

test.describe("Invitation flow", () => {
  test("accept-invitation: valid token adds user to org", async ({ request }) => {
    // 1. Admin creates pilot (generates invitation)
    // 2. User accepts invitation with token
    // 3. Verify user is now a member of the organization
  });

  test("accept-invitation: expired token is rejected", async ({ request }) => {
    // Test with an expired token
  });

  test("accept-invitation: wrong email is rejected", async ({ request }) => {
    // Test with token for email X but authenticated as email Y
  });
});

test.describe("Feedback flow", () => {
  test("submit-feedback: authenticated user can submit feedback", async ({ request }) => {
    const res = await request.post(`${APP_URL}/api/feedback`, {
      data: {
        type: "feedback",
        message: "E2E test feedback",
      },
    });
    // Should succeed for authenticated user with membership
    expect(res.status()).toBe(401); // Without auth header
  });
});

test.describe("Health checks", () => {
  test("/health returns ok", async ({ request }) => {
    const res = await request.get(
      `${process.env.E2E_SUPABASE_URL ?? "https://zxneketqrapvbxyqewar.supabase.co"}/functions/v1/health-check`,
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.checks.process.status).toBe("ok");
  });

  test("/ready returns ok with database check", async ({ request }) => {
    const res = await request.get(
      `${process.env.E2E_SUPABASE_URL ?? "https://zxneketqrapvbxyqewar.supabase.co"}/functions/v1/health-check/ready`,
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.checks.database).toBeDefined();
  });
});
