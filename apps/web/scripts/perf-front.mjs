import { chromium } from "@playwright/test";

const BASE = "http://localhost:3020";
const routes = ["/app/mapa", "/app/kanban", "/app/painel", "/app/hoje"];

const browser = await chromium.launch();

for (const route of routes) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const jsBytes = { total: 0 };
  const reqCount = { total: 0 };
  page.on("response", (res) => {
    const url = res.url();
    if (!url.includes("localhost:3020")) return; // ignore Google Maps/fonts external
    reqCount.total++;
    const len = Number(res.headers()["content-length"] ?? 0);
    jsBytes.total += len;
  });

  await page.goto(BASE + route, { waitUntil: "load", timeout: 30000 });

  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const lcpEntry = performance.getEntriesByType("largest-contentful-paint").at(-1);
    const paint = performance.getEntriesByType("paint");
    const fcp = paint.find((p) => p.name === "first-contentful-paint")?.startTime;
    const mem = performance.memory;
    return {
      ttfb: nav?.responseStart,
      domContentLoaded: nav?.domContentLoadedEventEnd,
      load: nav?.loadEventEnd,
      fcp: fcp ? Math.round(fcp) : null,
      lcp: lcpEntry ? Math.round(lcpEntry.startTime) : null,
      heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null,
      transferSize:
        nav?.transferSize ??
        performance.getEntriesByType("resource").reduce((s, r) => s + (r.transferSize || 0), 0),
    };
  });

  console.log(
    `${route.padEnd(14)} TTFB=${metrics.ttfb ?? "?"}ms  FCP=${metrics.fcp ?? "?"}ms  LCP=${metrics.lcp ?? "?"}ms  load=${metrics.load ?? "?"}ms  heap=${metrics.heapMB ?? "?"}MB  reqs=${reqCount.total}  localBytes=${Math.round(jsBytes.total / 1024)}KB`,
  );
  await context.close();
}

await browser.close();
