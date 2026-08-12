// Deno-native test — skipped when running under bun test.
// Run with: deno test --allow-env supabase/functions/_shared/google-calendar.test.ts

import {
  buildCalendarEventBody,
  decryptTokenPayload,
  encryptTokenPayload,
  googleEventId,
  safeReturnTo,
  type CalendarActivity,
} from "./google-calendar.ts";

// Declared at module root: a function declaration inside the `else` block below
// trips no-inner-declarations.
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const activity = (over: Partial<CalendarActivity> = {}): CalendarActivity => ({
  id: "act-1",
  title: "Reunião com Cliente",
  description: "Briefing inicial",
  scheduledAt: "2026-08-15T17:00:00.000Z",
  scheduledEndAt: "2026-08-15T18:00:00.000Z",
  timezone: "America/Sao_Paulo",
  attendeeEmail: "cliente@exemplo.com",
  leadName: "Salão da Ana",
  ...over,
});

// Under bun test, exit silently before reaching Deno.test().
// The imports are safe — http.ts guards against missing Deno at module level.
if (typeof Deno === "undefined") {
  // No-op: bun test sees zero tests in this file.
  // Using a dynamic check that doesn't crash the test runner.
  const _noop = true;
  void _noop;
} else {
  const FALLBACK = "/app/configuracoes?section=integracoes";

  Deno.test("safeReturnTo accepts local paths and rejects external redirects", () => {
    assert(safeReturnTo(FALLBACK) === FALLBACK, "should keep local path");
    assert(safeReturnTo("https://evil.com") === FALLBACK, "should reject external URL");
    assert(safeReturnTo("//evil.com") === FALLBACK, "should reject protocol-relative URL");
    assert(safeReturnTo(undefined) === FALLBACK, "should reject non-string");
    assert(safeReturnTo("/app/mapa") === "/app/mapa", "should keep an arbitrary local path");
  });

  Deno.test("safeReturnTo truncates very long paths", () => {
    const long = "/app/" + "a".repeat(1000);
    assert(safeReturnTo(long).length === 500, "should cap at 500 chars");
  });

  Deno.test("googleEventId is deterministic and unique per activity", async () => {
    const a = await googleEventId("act-1");
    const b = await googleEventId("act-1");
    const c = await googleEventId("act-2");
    assert(a === b, "same activity should produce same id");
    assert(a !== c, "different activities should produce different ids");
    assert(a.startsWith("prospeca"), "id should carry the prospeca prefix");
  });

  Deno.test("buildCalendarEventBody maps an activity onto the Google event shape", () => {
    const body = buildCalendarEventBody(activity());
    assert(body.summary === "Reunião com Cliente", "summary mismatch");
    assert(body.description.includes("Salão da Ana"), "lead name missing from description");
    assert(body.description.includes("Briefing inicial"), "description text missing");
    assert(body.start.dateTime === "2026-08-15T17:00:00.000Z", "start mismatch");
    assert(body.end.dateTime === "2026-08-15T18:00:00.000Z", "end mismatch");
    assert(body.start.timeZone === "America/Sao_Paulo", "timezone mismatch");
    assert(body.attendees?.[0]?.email === "cliente@exemplo.com", "attendee mismatch");
    assert(
      body.extendedProperties.private.prospecaActivityId === "act-1",
      "activity id should round-trip through extendedProperties",
    );
  });

  Deno.test("buildCalendarEventBody defaults to a 30-minute meeting", () => {
    const body = buildCalendarEventBody(activity({ scheduledEndAt: null }));
    const minutes =
      (new Date(body.end.dateTime).getTime() - new Date(body.start.dateTime).getTime()) / 60_000;
    assert(minutes === 30, `expected 30 minutes, got ${minutes}`);
  });

  Deno.test("buildCalendarEventBody omits attendees when there is no e-mail", () => {
    const body = buildCalendarEventBody(activity({ attendeeEmail: null }));
    assert(body.attendees === undefined, "attendees should be omitted, not empty");
  });

  Deno.test("buildCalendarEventBody requests a Meet link unless opted out", () => {
    assert(buildCalendarEventBody(activity()).conferenceData !== undefined, "Meet expected");
    assert(
      buildCalendarEventBody(activity(), false).conferenceData === undefined,
      "Meet should be skipped when createMeet is false",
    );
  });

  Deno.test("buildCalendarEventBody rejects an invalid or inverted range", () => {
    const rejects = (over: Partial<CalendarActivity>, why: string) => {
      let threw = false;
      try {
        buildCalendarEventBody(activity(over));
      } catch {
        threw = true;
      }
      assert(threw, `expected a rejection: ${why}`);
    };
    rejects({ scheduledAt: "not-a-date" }, "invalid start");
    rejects({ scheduledEndAt: "2026-08-15T16:00:00.000Z" }, "end before start");
    rejects({ scheduledEndAt: "2026-08-15T17:00:00.000Z" }, "zero-length meeting");
  });

  Deno.test("encryptTokenPayload / decryptTokenPayload round-trip", async () => {
    const previous = Deno.env.get("INTEGRATION_TOKEN_ENCRYPTION_KEY");
    // Exactly 32 bytes in base64 — encryptionKey() rejects any other length.
    Deno.env.set(
      "INTEGRATION_TOKEN_ENCRYPTION_KEY",
      "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
    );
    try {
      const original = {
        accessToken: "access-secret",
        refreshToken: "refresh-secret",
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        tokenType: "Bearer",
      };
      const encrypted = await encryptTokenPayload(original);
      assert(!encrypted.encryptedPayload.includes("access-secret"), "token leaked in ciphertext");
      const decrypted = await decryptTokenPayload(encrypted.encryptedPayload, encrypted.iv);
      assert(JSON.stringify(decrypted) === JSON.stringify(original), "round-trip mismatch");
    } finally {
      if (previous) Deno.env.set("INTEGRATION_TOKEN_ENCRYPTION_KEY", previous);
      else Deno.env.delete("INTEGRATION_TOKEN_ENCRYPTION_KEY");
    }
  });
}
