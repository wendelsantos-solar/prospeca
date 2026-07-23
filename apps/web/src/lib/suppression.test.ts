import { test, expect } from "bun:test";
import { suppressionHash, suppressionEntriesFor } from "./suppression";

test("phone hash is deterministic and normalized to e164", async () => {
  const a = await suppressionHash("phone", "+55 21 99189-8369");
  const b = await suppressionHash("phone", "(21) 99189-8369");
  expect(a).toBe(b); // same normalized number → same hash
  expect(a).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
});

test("email hash normalizes case/whitespace", async () => {
  const a = await suppressionHash("email", "  Contato@EX.com ");
  const b = await suppressionHash("email", "contato@ex.com");
  expect(a).toBe(b);
});

test("different values hash differently", async () => {
  const a = await suppressionHash("phone", "+552199189836 9".replace(/\s/g, ""));
  const b = await suppressionHash("email", "contato@ex.com");
  expect(a).not.toBe(b);
});

test("suppressionEntriesFor builds entries only for present, valid contacts", async () => {
  const entries = await suppressionEntriesFor({
    phone: "(21) 99189-8369",
    email: "c@ex.com",
    reason: "opt-out",
  });
  expect(entries).toHaveLength(2);
  expect(entries.map((e) => e.type).sort()).toEqual(["email", "phone"]);
  expect(entries.every((e) => e.value_hash.match(/^[0-9a-f]{64}$/))).toBe(true);
  expect(entries.every((e) => e.reason === "opt-out")).toBe(true);
});

test("suppressionEntriesFor skips a landline (not a contactable mobile) but keeps email", async () => {
  const entries = await suppressionEntriesFor({ phone: "(21) 3333-4444", email: null });
  // landline is still a phone contact → suppressed as phone
  expect(entries.map((e) => e.type)).toEqual(["phone"]);
});

test("suppressionEntriesFor returns [] when nothing to suppress", async () => {
  expect(await suppressionEntriesFor({ phone: null, email: null })).toEqual([]);
});
