import { expect, test } from "bun:test";
import { verifyStripeSignature, SIGNATURE_TOLERANCE_SEC } from "./stripe-signature.ts";

const SECRET = "whsec_test_2f6a1c9d4e7b";
const PAYLOAD = JSON.stringify({ id: "evt_1", type: "customer.subscription.updated" });
const NOW_MS = 1_700_000_000_000;
const NOW_SEC = Math.floor(NOW_MS / 1000);

/** Real HMAC-SHA256, exactly as Stripe computes it. Test-side, no shared code with the module. */
async function sign(payload: string, secret: string, timestampSec: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestampSec}.${payload}`),
  );
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const header = async (opts: { payload?: string; secret?: string; ts?: number } = {}) => {
  const ts = opts.ts ?? NOW_SEC;
  return `t=${ts},v1=${await sign(opts.payload ?? PAYLOAD, opts.secret ?? SECRET, ts)}`;
};

test("valid signature -> accepted", async () => {
  expect(
    await verifyStripeSignature({
      payload: PAYLOAD,
      header: await header(),
      secret: SECRET,
      nowMs: NOW_MS,
    }),
  ).toBe(true);
});

test("tampered payload -> rejected", async () => {
  const forged = JSON.stringify({ id: "evt_1", type: "customer.subscription.deleted" });
  expect(
    await verifyStripeSignature({
      payload: forged,
      header: await header(),
      secret: SECRET,
      nowMs: NOW_MS,
    }),
  ).toBe(false);
});

test("signature made with a different secret -> rejected", async () => {
  const h = await header({ secret: "whsec_attacker" });
  expect(
    await verifyStripeSignature({ payload: PAYLOAD, header: h, secret: SECRET, nowMs: NOW_MS }),
  ).toBe(false);
});

test("empty secret -> rejected (fails closed)", async () => {
  expect(
    await verifyStripeSignature({
      payload: PAYLOAD,
      header: await header(),
      secret: "",
      nowMs: NOW_MS,
    }),
  ).toBe(false);
});

test("header without a v1 scheme -> rejected", async () => {
  expect(
    await verifyStripeSignature({
      payload: PAYLOAD,
      header: `t=${NOW_SEC}`,
      secret: SECRET,
      nowMs: NOW_MS,
    }),
  ).toBe(false);
});

test("malformed header -> rejected", async () => {
  expect(
    await verifyStripeSignature({
      payload: PAYLOAD,
      header: "not-a-signature",
      secret: SECRET,
      nowMs: NOW_MS,
    }),
  ).toBe(false);
});

test("empty header -> rejected", async () => {
  expect(
    await verifyStripeSignature({ payload: PAYLOAD, header: "", secret: SECRET, nowMs: NOW_MS }),
  ).toBe(false);
});

test("v1 that is not valid hex -> rejected", async () => {
  const h = `t=${NOW_SEC},v1=zzzz`;
  expect(
    await verifyStripeSignature({ payload: PAYLOAD, header: h, secret: SECRET, nowMs: NOW_MS }),
  ).toBe(false);
});

test("replay: timestamp older than the tolerance window -> rejected", async () => {
  const ts = NOW_SEC - (SIGNATURE_TOLERANCE_SEC + 1);
  const h = await header({ ts });
  expect(
    await verifyStripeSignature({ payload: PAYLOAD, header: h, secret: SECRET, nowMs: NOW_MS }),
  ).toBe(false);
});

test("timestamp just inside the tolerance window -> accepted", async () => {
  const ts = NOW_SEC - (SIGNATURE_TOLERANCE_SEC - 1);
  const h = await header({ ts });
  expect(
    await verifyStripeSignature({ payload: PAYLOAD, header: h, secret: SECRET, nowMs: NOW_MS }),
  ).toBe(true);
});

test("timestamp too far in the future -> rejected (clock-skew forgery)", async () => {
  const ts = NOW_SEC + (SIGNATURE_TOLERANCE_SEC + 1);
  const h = await header({ ts });
  expect(
    await verifyStripeSignature({ payload: PAYLOAD, header: h, secret: SECRET, nowMs: NOW_MS }),
  ).toBe(false);
});

test("non-numeric timestamp -> rejected", async () => {
  const h = `t=abc,v1=${await sign(PAYLOAD, SECRET, NOW_SEC)}`;
  expect(
    await verifyStripeSignature({ payload: PAYLOAD, header: h, secret: SECRET, nowMs: NOW_MS }),
  ).toBe(false);
});

test("secret rotation: several v1 values, one valid -> accepted", async () => {
  const stale = await sign(PAYLOAD, "whsec_old", NOW_SEC);
  const good = await sign(PAYLOAD, SECRET, NOW_SEC);
  const h = `t=${NOW_SEC},v1=${stale},v1=${good}`;
  expect(
    await verifyStripeSignature({ payload: PAYLOAD, header: h, secret: SECRET, nowMs: NOW_MS }),
  ).toBe(true);
});

test("several v1 values, none valid -> rejected", async () => {
  const a = await sign(PAYLOAD, "whsec_old", NOW_SEC);
  const b = await sign(PAYLOAD, "whsec_older", NOW_SEC);
  const h = `t=${NOW_SEC},v1=${a},v1=${b}`;
  expect(
    await verifyStripeSignature({ payload: PAYLOAD, header: h, secret: SECRET, nowMs: NOW_MS }),
  ).toBe(false);
});

test("v0 scheme alone is ignored -> rejected", async () => {
  const h = `t=${NOW_SEC},v0=${await sign(PAYLOAD, SECRET, NOW_SEC)}`;
  expect(
    await verifyStripeSignature({ payload: PAYLOAD, header: h, secret: SECRET, nowMs: NOW_MS }),
  ).toBe(false);
});

test("signature is bound to its own timestamp, not a replayed fresh one", async () => {
  // Signature computed for an old timestamp, header claims it is fresh.
  const old = await sign(PAYLOAD, SECRET, NOW_SEC - 10_000);
  const h = `t=${NOW_SEC},v1=${old}`;
  expect(
    await verifyStripeSignature({ payload: PAYLOAD, header: h, secret: SECRET, nowMs: NOW_MS }),
  ).toBe(false);
});
