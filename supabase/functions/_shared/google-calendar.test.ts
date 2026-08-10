// Deno-native test — skipped when running under bun test.
// Run with: deno test supabase/functions/_shared/google-calendar.test.ts

import {
  buildCalendarEventBody,
  decryptTokenPayload,
  encryptTokenPayload,
  googleEventId,
  safeReturnTo,
} from "./google-calendar.ts";

// Under bun test, exit silently before reaching Deno.test().
// The imports are safe — http.ts guards against missing Deno at module level.
if (typeof Deno === "undefined") {
  // No-op: bun test sees zero tests in this file.
  // Using a dynamic check that doesn't crash the test runner.
  const _noop = true;
  void _noop;
} else {
  function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
  }

  Deno.test("safeReturnTo accepts local paths and rejects external redirects", () => {
    assert(
      safeReturnTo("/app/configuracoes?section=integracoes") ===
        "/app/configuracoes?section=integracoes",
      "should keep local path",
    );
    assert(safeReturnTo("https://evil.com") === "/app", "should reject external URL");
    assert(safeReturnTo("//evil.com") === "/app", "should reject protocol-relative URL");
  });

  Deno.test("googleEventId is deterministic and unique per lead", () => {
    const a = googleEventId("lead-1", "2026-08-10T14:00:00Z");
    const b = googleEventId("lead-1", "2026-08-10T14:00:00Z");
    const c = googleEventId("lead-2", "2026-08-10T14:00:00Z");
    assert(a === b, "same lead + time should produce same id");
    assert(a !== c, "different leads should produce different ids");
  });

  Deno.test("buildCalendarEventBody returns valid event shape", () => {
    const body = buildCalendarEventBody({
      title: "Reunião com Cliente",
      description: "Briefing inicial",
      startDateTime: "2026-08-15T14:00:00-03:00",
      endDateTime: "2026-08-15T15:00:00-03:00",
      attendees: [{ email: "cliente@exemplo.com" }],
      location: "Rua Exemplo, 123",
    });
    assert(body.summary === "Reunião com Cliente", "summary mismatch");
    assert(body.description === "Briefing inicial", "description mismatch");
    assert(body.start?.dateTime === "2026-08-15T14:00:00-03:00", "start mismatch");
    assert(body.end?.dateTime === "2026-08-15T15:00:00-03:00", "end mismatch");
    assert(body.location === "Rua Exemplo, 123", "location mismatch");
    assert(body.attendees?.[0]?.email === "cliente@exemplo.com", "attendee mismatch");
  });

  Deno.test("encryptTokenPayload / decryptTokenPayload round-trip", async () => {
    const previous = Deno.env.get("INTEGRATION_TOKEN_ENCRYPTION_KEY");
    Deno.env.set(
      "INTEGRATION_TOKEN_ENCRYPTION_KEY",
      "c29tZS1zZWNyZXQta2V5LWZvci10ZXN0aW5nLXB1cnBvc2VzLW9ubHk",
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
