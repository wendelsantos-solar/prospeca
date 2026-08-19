/** Pure axis-scale helpers shared by the SVG MiniCharts. */

/** Round a max value up to a "nice" axis ceiling (1/2/5 × 10^n). */
export function niceCeil(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  const frac = value / base;
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return nice * base;
}

/** n+1 evenly spaced ticks from 0 to max (max already "nice"). */
export function makeTicks(max: number, n: number): number[] {
  if (n <= 0) return [0];
  const out: number[] = [];
  for (let i = 0; i <= n; i++) out.push(Number(((max * i) / n).toFixed(2)));
  return out;
}
