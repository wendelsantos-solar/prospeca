import {
  buildCalendarEventBody,
  decryptTokenPayload,
  encryptTokenPayload,
  googleEventId,
  safeReturnTo,
} from "./google-calendar.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("safeReturnTo accepts local paths and rejects external redirects", () => {
  assert(
    safeReturnTo("/app/configuracoes?section=integracoes") ===
      "/app/configuracoes?section=integracoes",
    "expected local path",
  );
  assert(
    safeReturnTo("https://attacker.example") ===
      "/app/configuracoes?section=integracoes",
    "expected external URL to be rejected",
  );
  assert(
    safeReturnTo("//attacker.example") ===
      "/app/configuracoes?section=integracoes",
    "expected protocol-relative URL to be rejected",
  );
});

Deno.test("Google event IDs are deterministic and Calendar-compatible", async () => {
  const first = await googleEventId("8f86b932-8e20-4ff7-98e7-59fbe4da3557");
  const second = await googleEventId("8f86b932-8e20-4ff7-98e7-59fbe4da3557");
  assert(first === second, "expected deterministic ID");
  assert(
    /^prospeca[0-9a-f]{64}$/.test(first),
    "expected lowercase hexadecimal ID",
  );
});

Deno.test("Calendar payload includes attendee, duration and a fresh Meet request", () => {
  const body = buildCalendarEventBody(
    {
      id: "8f86b932-8e20-4ff7-98e7-59fbe4da3557",
      title: "Diagnóstico comercial",
      leadName: "Clínica Exemplo",
      description: "Revisar oportunidade",
      scheduledAt: "2026-08-10T13:00:00.000Z",
      scheduledEndAt: "2026-08-10T13:45:00.000Z",
      timezone: "America/Sao_Paulo",
      attendeeEmail: "contato@example.com",
    },
    true,
  );
  assert(body.start.dateTime === "2026-08-10T13:00:00.000Z", "expected start");
  assert(body.end.dateTime === "2026-08-10T13:45:00.000Z", "expected end");
  assert(
    body.attendees?.[0]?.email === "contato@example.com",
    "expected attendee",
  );
  assert(
    Boolean(body.conferenceData?.createRequest.requestId),
    "expected Meet request",
  );
});

Deno.test("OAuth credentials round-trip through AES-GCM", async () => {
  const previous = Deno.env.get("INTEGRATION_TOKEN_ENCRYPTION_KEY");
  Deno.env.set(
    "INTEGRATION_TOKEN_ENCRYPTION_KEY",
    btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))),
  );
  try {
    const original = {
      accessToken: "access-secret",
      refreshToken: "refresh-secret",
      expiresAt: "2026-08-10T13:00:00.000Z",
      tokenType: "Bearer",
    };
    const encrypted = await encryptTokenPayload(original);
    assert(
      !encrypted.encryptedPayload.includes("access-secret"),
      "token leaked in ciphertext",
    );
    const decrypted = await decryptTokenPayload(
      encrypted.encryptedPayload,
      encrypted.iv,
    );
    assert(
      JSON.stringify(decrypted) === JSON.stringify(original),
      "round-trip mismatch",
    );
  } finally {
    if (previous) Deno.env.set("INTEGRATION_TOKEN_ENCRYPTION_KEY", previous);
    else Deno.env.delete("INTEGRATION_TOKEN_ENCRYPTION_KEY");
  }
});
