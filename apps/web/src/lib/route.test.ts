import { test, expect } from "bun:test";
import { optimizeVisitOrder, buildGoogleMapsRouteUrl } from "./route";

// Three points roughly on a line, fed in shuffled/non-optimal order:
//   A (0,0) --- B (0,0.01) --- C (0,0.03)
// Nearest-neighbor from A should visit B then C, not C then B.
const A = { id: "a", lat: 0, lng: 0 };
const B = { id: "b", lat: 0, lng: 0.01 };
const C = { id: "c", lat: 0, lng: 0.03 };

test("optimizeVisitOrder returns [] for no stops", () => {
  expect(optimizeVisitOrder([])).toEqual([]);
});

test("optimizeVisitOrder with a single stop and no origin — that stop starts the route", () => {
  const result = optimizeVisitOrder([A]);
  expect(result).toHaveLength(1);
  expect(result[0].id).toBe("a");
  expect(result[0].legKm).toBe(0);
});

test("optimizeVisitOrder with a single stop and an origin — legKm is the distance from origin", () => {
  const result = optimizeVisitOrder([C], { lat: 0, lng: 0 });
  expect(result).toHaveLength(1);
  expect(result[0].legKm).toBeGreaterThan(3);
  expect(result[0].legKm).toBeLessThan(3.5);
});

test("optimizeVisitOrder greedily picks the nearest unvisited stop at each step (no origin)", () => {
  // Fed in a deliberately bad order (A, C, B) — nearest-neighbor from A must
  // still visit B before C, since B is closer to A than C is.
  const result = optimizeVisitOrder([A, C, B]);
  expect(result.map((s) => s.id)).toEqual(["a", "b", "c"]);
});

test("optimizeVisitOrder starts from an explicit origin instead of the first stop", () => {
  // Origin sits right next to C — nearest-neighbor should visit C first.
  const origin = { lat: 0, lng: 0.031 };
  const result = optimizeVisitOrder([A, B, C], origin);
  expect(result.map((s) => s.id)).toEqual(["c", "b", "a"]);
});

test("optimizeVisitOrder never drops or duplicates a stop", () => {
  const stops = [A, B, C, { id: "d", lat: 0.02, lng: -0.01 }];
  const result = optimizeVisitOrder(stops);
  expect(result.map((s) => s.id).sort()).toEqual(["a", "b", "c", "d"]);
});

test("buildGoogleMapsRouteUrl returns empty string for no stops", () => {
  expect(buildGoogleMapsRouteUrl([])).toBe("");
});

test("buildGoogleMapsRouteUrl puts the last stop as destination and the rest as waypoints", () => {
  const url = buildGoogleMapsRouteUrl([A, B, C]);
  expect(url).toContain("destination=0%2C0.03");
  expect(url).toContain("waypoints=0%2C0%7C0%2C0.01");
  expect(url).not.toContain("origin=");
});

test("buildGoogleMapsRouteUrl includes an explicit origin when given", () => {
  const url = buildGoogleMapsRouteUrl([B, C], { lat: 0, lng: 0 });
  expect(url).toContain("origin=0%2C0");
  expect(url).toContain("destination=0%2C0.03");
  expect(url).toContain("waypoints=0%2C0.01");
});

test("buildGoogleMapsRouteUrl with a single stop has no waypoints param", () => {
  const url = buildGoogleMapsRouteUrl([A]);
  expect(url).toContain("destination=0%2C0");
  expect(url).not.toContain("waypoints=");
});
