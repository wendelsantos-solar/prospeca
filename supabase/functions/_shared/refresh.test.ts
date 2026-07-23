import { expect, test } from "bun:test";
import { FORCE_COOLDOWN_MS, shouldForceRefresh } from "./refresh.ts";

const NOW = 1_700_000_000_000; // fixed epoch for determinism

test("no forceRefresh -> never forces (serves cache)", () => {
  expect(shouldForceRefresh(false, null, NOW)).toBe(false);
  expect(shouldForceRefresh(false, NOW - 1, NOW)).toBe(false);
});

test("forceRefresh with no prior force -> forces", () => {
  expect(shouldForceRefresh(true, null, NOW)).toBe(true);
});

test("forceRefresh within cooldown -> blocked (falls back to cache)", () => {
  const lastForced = NOW - (FORCE_COOLDOWN_MS - 1_000); // 1s inside the window
  expect(shouldForceRefresh(true, lastForced, NOW)).toBe(false);
});

test("forceRefresh past cooldown -> forces again", () => {
  const lastForced = NOW - (FORCE_COOLDOWN_MS + 1_000); // 1s past the window
  expect(shouldForceRefresh(true, lastForced, NOW)).toBe(true);
});

test("boundary: exactly at cooldown edge forces (>= window)", () => {
  const lastForced = NOW - FORCE_COOLDOWN_MS; // now - last == cooldown, not < cooldown
  expect(shouldForceRefresh(true, lastForced, NOW)).toBe(true);
});
