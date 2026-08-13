import { describe, it, expect } from "bun:test";
import { niceCeil, makeTicks } from "@/lib/chart-scale";

describe("niceCeil", () => {
  it("rounds up to a nice axis ceiling", () => {
    expect(niceCeil(1)).toBe(1);
    expect(niceCeil(4)).toBe(5);
    expect(niceCeil(6)).toBe(10);
    expect(niceCeil(23)).toBe(50);
    expect(niceCeil(76)).toBe(100);
    expect(niceCeil(120)).toBe(200);
    expect(niceCeil(950)).toBe(1000);
  });

  it("handles zero/negative defensively", () => {
    expect(niceCeil(0)).toBe(1);
    expect(niceCeil(-5)).toBe(1);
  });
});

describe("makeTicks", () => {
  it("produces n+1 evenly spaced ticks from 0 to max", () => {
    expect(makeTicks(100, 4)).toEqual([0, 25, 50, 75, 100]);
    expect(makeTicks(10, 2)).toEqual([0, 5, 10]);
  });

  it("returns [0] when n <= 0", () => {
    expect(makeTicks(100, 0)).toEqual([0]);
  });
});
