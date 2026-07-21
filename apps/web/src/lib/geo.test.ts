import { test, expect } from "bun:test";
import { distanceKm } from "./geo";

test("distanceKm is 0 for the same point", () => {
  expect(distanceKm({ lat: -30.03, lng: -51.22 }, { lat: -30.03, lng: -51.22 })).toBe(0);
});

test("distanceKm ~1.11km per 0.01 degree of latitude", () => {
  const d = distanceKm({ lat: 0, lng: 0 }, { lat: 0.01, lng: 0 });
  expect(d).toBeGreaterThan(1.1);
  expect(d).toBeLessThan(1.12);
});

test("distanceKm Rio to São Paulo is ~360km", () => {
  const d = distanceKm({ lat: -22.9068, lng: -43.1729 }, { lat: -23.5505, lng: -46.6333 });
  expect(d).toBeGreaterThan(355);
  expect(d).toBeLessThan(365);
});
