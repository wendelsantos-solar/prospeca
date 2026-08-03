import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const API_URL = process.env.SUPABASE_TEST_URL ?? "http://127.0.0.1:54321";
const ANON_KEY =
  process.env.SUPABASE_TEST_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const LOCAL_SERVICE_KEY =
  process.env.SUPABASE_TEST_SERVICE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const RUN = Math.random().toString(36).slice(2, 10);
const admin = createClient(API_URL, LOCAL_SERVICE_KEY, { auth: { persistSession: false } });

async function isReachable(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/rest/v1/`, {
      headers: { apikey: ANON_KEY },
      signal: AbortSignal.timeout(2_000),
    });
    return response.status < 500;
  } catch {
    return false;
  }
}

const available = await isReachable();
const requireDatabase = process.env.REQUIRE_RLS_DB === "true";
if (!available && requireDatabase) {
  throw new Error(`Supabase local obrigatório, mas indisponível em ${API_URL}.`);
}
const describeIfDb = available ? describe : describe.skip;

describeIfDb("Edge Function organization context", () => {
  let userId = "";
  let primaryOrganizationId = "";
  let selectedOrganizationId = "";
  let accessToken = "";
  let authenticatedClient: SupabaseClient;
  let feedbackPath = "";

  beforeAll(async () => {
    const email = `edge-org-${RUN}@radar.test`;
    const password = `Test-${RUN}-Context!`;
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Edge Org Test", company_name: `Primary ${RUN}` },
    });
    if (createError || !created.user) throw createError ?? new Error("Usuário não criado.");
    userId = created.user.id;

    const { data: membership, error: membershipError } = await admin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();
    if (membershipError) throw membershipError;
    primaryOrganizationId = membership.organization_id;

    const { data: selectedOrg, error: organizationError } = await admin
      .from("organizations")
      .insert({
        name: `Selected ${RUN}`,
        slug: `selected-${RUN}`,
        owner_user_id: userId,
      })
      .select("id")
      .single();
    if (organizationError) throw organizationError;
    selectedOrganizationId = selectedOrg.id;

    const { error: secondMembershipError } = await admin.from("organization_members").insert({
      organization_id: selectedOrganizationId,
      user_id: userId,
      role: "owner",
    });
    if (secondMembershipError) throw secondMembershipError;

    const { error: usageError } = await admin.from("usage_events").insert([
      {
        organization_id: primaryOrganizationId,
        user_id: userId,
        event_type: "place_search_request",
        provider: "google_places",
        quantity: 11,
      },
      {
        organization_id: selectedOrganizationId,
        user_id: userId,
        event_type: "place_search_request",
        provider: "google_places",
        quantity: 37,
      },
    ]);
    if (usageError) throw usageError;

    authenticatedClient = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
    const { data: session, error: signInError } = await authenticatedClient.auth.signInWithPassword(
      {
        email,
        password,
      },
    );
    if (signInError || !session.session) throw signInError ?? new Error("Sessão não criada.");
    accessToken = session.session.access_token;
  });

  afterAll(async () => {
    if (feedbackPath) {
      await admin.storage.from("feedback-attachments").remove([feedbackPath]);
    }
    if (selectedOrganizationId) {
      await admin.from("organizations").delete().eq("id", selectedOrganizationId);
    }
    if (primaryOrganizationId) {
      await admin.from("organizations").delete().eq("id", primaryOrganizationId);
    }
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  async function getUsage(organizationId?: string) {
    const headers: Record<string, string> = {
      apikey: ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
    if (organizationId) headers["x-organization-id"] = organizationId;
    const response = await fetch(`${API_URL}/functions/v1/get-usage-summary`, {
      method: "POST",
      headers,
      body: "{}",
    });
    return { response, body: await response.json() };
  }

  test("uses the explicitly selected organization instead of the first membership", async () => {
    const fallback = await getUsage();
    const selected = await getUsage(selectedOrganizationId);

    expect(fallback.response.status).toBe(200);
    expect(fallback.body.searchPages).toBe(11);
    expect(selected.response.status).toBe(200);
    expect(selected.body.searchPages).toBe(37);
  });

  test("rejects a requested organization without membership", async () => {
    const unauthorized = await getUsage(crypto.randomUUID());
    expect(unauthorized.response.status).toBe(403);
    expect(unauthorized.body.code).toBe("FORBIDDEN");
  });

  test("stores authenticated feedback with a private screenshot path", async () => {
    feedbackPath = `${selectedOrganizationId}/${userId}/${crypto.randomUUID()}.png`;
    const { error: uploadError } = await authenticatedClient.storage
      .from("feedback-attachments")
      .upload(feedbackPath, new Uint8Array([137, 80, 78, 71]), {
        contentType: "image/png",
      });
    expect(uploadError).toBeNull();

    const message = `Feedback privado ${RUN}`;
    const response = await fetch(`${API_URL}/functions/v1/submit-feedback`, {
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "x-organization-id": selectedOrganizationId,
      },
      body: JSON.stringify({
        type: "bug",
        message,
        screenshotPath: feedbackPath,
        currentPage: "/app/kanban",
      }),
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    const { data: storedFeedback, error: feedbackError } = await admin
      .from("feedback")
      .select("organization_id, user_id, screenshot_path, screenshot_url")
      .eq("message", message)
      .single();
    expect(feedbackError).toBeNull();
    expect(storedFeedback).toEqual({
      organization_id: selectedOrganizationId,
      user_id: userId,
      screenshot_path: feedbackPath,
      screenshot_url: null,
    });
  });
});
