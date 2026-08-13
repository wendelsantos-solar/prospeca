// UI audit script — drives the demo app with Playwright, collecting console
// errors, page errors, failed requests, and structural/a11y signals per route.
// Output is JSON to stdout for interpretation (no screenshots — text-first).
import { chromium } from "@playwright/test";

const BASE = process.env.ANALYZE_URL ?? "http://localhost:3010";

const ROUTES = [
  "/app/mapa",
  "/app/hoje",
  "/app/kanban",
  "/app/painel",
  "/app/configuracoes",
  "/app/configuracoes/motor",
  "/app/configuracoes/integracoes",
];

const results = [];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

// ── collectors ─────────────────────────────────────────────────────────
const consoleIssues = [];
const pageErrors = [];
const failedRequests = [];
page.on("console", (msg) => {
  if (msg.type() === "error" || msg.type() === "warning") {
    consoleIssues.push({ type: msg.type(), text: msg.text().slice(0, 300) });
  }
});
page.on("pageerror", (err) => pageErrors.push(String(err).slice(0, 300)));
page.on("requestfailed", (req) => {
  const url = req.url();
  if (!url.includes("localhost:3010")) return; // ignore external (maps, fonts)
  failedRequests.push({
    url: url.replace(BASE, "").slice(0, 120),
    reason: req.failure()?.errorText ?? "?",
  });
});

async function settle() {
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
}

async function enterApp(path) {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  await settle();
  const skip = page.getByRole("button", { name: "Explorar sozinho" });
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
    await settle();
  }
}

// ── structural extraction ──────────────────────────────────────────────
async function extract(page) {
  return await page.evaluate(() => {
    const txt = (el) => (el?.textContent ?? "").trim();
    const h1 = [...document.querySelectorAll("h1")].map(txt).filter(Boolean);
    const h2 = [...document.querySelectorAll("h2")].map(txt).filter(Boolean);
    const buttons = [...document.querySelectorAll("button")]
      .map((b) => (b.getAttribute("aria-label") || b.textContent || "").trim())
      .filter((t) => t && t.length < 60);
    // a11y: images without alt, inputs without label/aria-label
    const imgNoAlt = [...document.querySelectorAll("img")].filter(
      (i) => !i.getAttribute("alt") && !i.getAttribute("aria-label"),
    ).length;
    const inputNoLabel = [...document.querySelectorAll("input,textarea,select")].filter(
      (el) =>
        !el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby") && !el.labels?.length,
    ).length;
    const bodyText = (document.body?.innerText ?? "").slice(0, 2500);
    const hasScroll = document.documentElement.scrollHeight > document.documentElement.clientHeight;
    return { h1, h2, buttons: [...new Set(buttons)], imgNoAlt, inputNoLabel, bodyText, hasScroll };
  });
}

for (const route of ROUTES) {
  consoleIssues.length = 0;
  pageErrors.length = 0;
  failedRequests.length = 0;
  await enterApp(route);
  const s = await extract(page);
  results.push({
    route,
    title: await page.title(),
    h1: s.h1,
    h2: s.h2.slice(0, 12),
    buttons: s.buttons.slice(0, 40),
    imgNoAlt: s.imgNoAlt,
    inputNoLabel: s.inputNoLabel,
    consoleIssues: [...consoleIssues],
    pageErrors: [...pageErrors],
    failedRequests: [...failedRequests],
    bodyText: s.bodyText,
  });
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
