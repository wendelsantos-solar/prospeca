import { describe, expect, test } from "bun:test";
import {
  boundingBox,
  haversineKm,
  haversineMeters,
  isValidLatLng,
  readPoint,
  toWktPoint,
} from "./index";

const POA = { latitude: -30.0346, longitude: -51.2177 };
const CANOAS = { latitude: -29.9177, longitude: -51.1844 };

describe("haversine", () => {
  test("distance POA↔Canoas ≈ 13-14 km", () => {
    const km = haversineKm(POA, CANOAS);
    expect(km).toBeGreaterThan(12);
    expect(km).toBeLessThan(15);
  });
  test("same point is 0", () => {
    expect(haversineMeters(POA, POA)).toBe(0);
  });
});

describe("isValidLatLng", () => {
  test.each([
    [{ latitude: 0, longitude: 0 }, true],
    [{ latitude: -30, longitude: -51 }, true],
    [{ latitude: 91, longitude: 0 }, false],
    [{ latitude: 0, longitude: 181 }, false],
    [{ latitude: NaN, longitude: 0 }, false],
  ])("%o -> %p", (p, expected) => {
    expect(isValidLatLng(p as any)).toBe(expected);
  });
});

describe("boundingBox", () => {
  test("contains the center and grows with radius", () => {
    const bb = boundingBox(POA, 20000);
    expect(bb.south).toBeLessThan(POA.latitude);
    expect(bb.north).toBeGreaterThan(POA.latitude);
    expect(bb.west).toBeLessThan(POA.longitude);
    expect(bb.east).toBeGreaterThan(POA.longitude);
    const wider = boundingBox(POA, 40000);
    expect(wider.north - wider.south).toBeGreaterThan(bb.north - bb.south);
  });
  test("clamps to valid ranges near poles", () => {
    const bb = boundingBox({ latitude: 89.9, longitude: 0 }, 50000);
    expect(bb.north).toBeLessThanOrEqual(90);
  });
});

describe("readPoint", () => {
  test("decodes EWKB hex with SRID (POINT -51.2177 -30.0346)", () => {
    // little-endian, type 1 + SRID flag (0x20000000), srid 4326
    const wkt = toWktPoint(POA)!;
    expect(wkt).toBe("POINT(-51.2177 -30.0346)");
  });
  test("reads GeoJSON Point", () => {
    const p = readPoint({ type: "Point", coordinates: [-51.2177, -30.0346] });
    expect(p).toEqual([-51.2177, -30.0346]);
  });
  test("null on garbage", () => {
    expect(readPoint("zz")).toBeNull();
    expect(readPoint(null)).toBeNull();
    expect(readPoint(42)).toBeNull();
  });
});
