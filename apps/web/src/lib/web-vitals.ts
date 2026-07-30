/**
 * Web Vitals reporting — LCP, CLS, INP, FCP, TTFB.
 *
 * Reports to console.debug in development and can be forwarded to analytics
 * in production. Lightweight (~1.5KB gzipped).
 *
 * Usage: import and call `reportWebVitals()` once in your app entry.
 */
import { onCLS, onINP, onLCP, onFCP, onTTFB } from "web-vitals";
import type { Metric } from "web-vitals";

type VitalsReporter = (metric: Metric) => void;

const consoleReporter: VitalsReporter = (metric) => {
  // Log all vitals in dev; only poor ones in prod
  const thresholds: Record<string, number> = {
    LCP: 2500, // Good < 2.5s
    CLS: 0.1, // Good < 0.1
    INP: 200, // Good < 200ms
    FCP: 1800, // Good < 1.8s
    TTFB: 800, // Good < 800ms
  };
  const threshold = thresholds[metric.name] ?? Infinity;
  const rating = metric.rating;

  if (import.meta.env.DEV || rating === "poor") {
    console.debug(
      `[web-vitals] ${metric.name}: ${Math.round(metric.value * 100) / 100} (${rating})`,
      metric,
    );
  }
};

let reported = false;

/**
 * Start reporting Web Vitals. Safe to call multiple times (idempotent).
 * Call once in your app entry (e.g., start.ts or root component).
 */
export function reportWebVitals(reporter: VitalsReporter = consoleReporter): void {
  if (reported) return;
  reported = true;

  onCLS(reporter);
  onINP(reporter);
  onLCP(reporter);
  onFCP(reporter);
  onTTFB(reporter);
}
