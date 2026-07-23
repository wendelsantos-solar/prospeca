import { describe, expect, test } from "bun:test";
import { circleContains, filterToCircle, haversineMeters } from "./coverage";

describe("haversineMeters", () => {
  test("~111m per 0.001° of latitude", () => {
    const d = haversineMeters(-30.0, -51.0, -30.001, -51.0);
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(115);
  });
  test("zero distance for same point", () => {
    expect(haversineMeters(-30, -51, -30, -51)).toBe(0);
  });
});

describe("circleContains", () => {
  const outer = { latitude: -30.0, longitude: -51.0, radiusMeters: 10000 };

  test("larger circle contains a nearby smaller circle", () => {
    // ~110m offset + 5km radius easily fits inside 10km.
    const inner = { latitude: -30.001, longitude: -51.0, radiusMeters: 5000 };
    expect(circleContains(outer, inner)).toBe(true);
  });

  test("rejects when inner spills past the outer edge", () => {
    // center ~6km away + 5km radius = 11km reach > 10km outer radius.
    const inner = { latitude: -30.054, longitude: -51.0, radiusMeters: 5000 };
    expect(circleContains(outer, inner)).toBe(false);
  });

  test("boundary: dist + innerR exactly equal to outerR contains", () => {
    // concentric: distance 0, inner radius == outer radius.
    const inner = { latitude: -30.0, longitude: -51.0, radiusMeters: 10000 };
    expect(circleContains(outer, inner)).toBe(true);
  });

  test("a smaller circle does NOT contain a larger one", () => {
    const inner = { latitude: -30.0, longitude: -51.0, radiusMeters: 20000 };
    expect(circleContains(outer, inner)).toBe(false);
  });
});

describe("filterToCircle", () => {
  const center = { latitude: -30.0, longitude: -51.0 };
  const points = [
    { id: "in", latitude: -30.0005, longitude: -51.0 }, // ~55m
    { id: "out", latitude: -30.02, longitude: -51.0 }, // ~2.2km
    { id: "nocoord", latitude: null, longitude: null },
  ];

  test("keeps points inside the radius and coord-less points, drops the rest", () => {
    const kept = filterToCircle(points, center, 1000).map((p) => p.id);
    expect(kept).toContain("in");
    expect(kept).toContain("nocoord");
    expect(kept).not.toContain("out");
  });

  test("wider radius keeps the far point too", () => {
    const kept = filterToCircle(points, center, 5000).map((p) => p.id);
    expect(kept).toEqual(["in", "out", "nocoord"]);
  });
});
