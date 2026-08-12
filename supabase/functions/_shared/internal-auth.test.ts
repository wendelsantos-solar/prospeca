import { expect, test } from "bun:test";
import { isInternalCall } from "./internal-auth.ts";

const KEY = "service-role-key-abc123";
const reqWith = (auth?: string) =>
  new Request("https://edge.local/fn", auth ? { headers: { Authorization: auth } } : undefined);

test("matching service-role bearer -> internal", async () => {
  expect(await isInternalCall(reqWith(`Bearer ${KEY}`), KEY)).toBe(true);
});

test("different key -> not internal", async () => {
  expect(await isInternalCall(reqWith("Bearer wrong-key"), KEY)).toBe(false);
});

test("no Authorization header -> not internal", async () => {
  expect(await isInternalCall(reqWith(), KEY)).toBe(false);
});

test("right key without the Bearer prefix -> not internal", async () => {
  expect(await isInternalCall(reqWith(KEY), KEY)).toBe(false);
});

test("unset service-role key -> not internal (fails closed)", async () => {
  // Guards the case where the env var is missing and the expected value would
  // otherwise collapse to a guessable literal like "Bearer undefined".
  expect(await isInternalCall(reqWith("Bearer undefined"), undefined)).toBe(false);
  expect(await isInternalCall(reqWith("Bearer "), "")).toBe(false);
  expect(await isInternalCall(reqWith(""), "")).toBe(false);
});

test("a prefix of the real key -> not internal", async () => {
  expect(await isInternalCall(reqWith(`Bearer ${KEY.slice(0, -1)}`), KEY)).toBe(false);
});
