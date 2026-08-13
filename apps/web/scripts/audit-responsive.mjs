// Responsive audit — checks every app route at mobile / tablet / desktop widths
// for horizontal overflow, elements clipped off the viewport, and whether the
// mobile navigation is correctly shown/hidden.
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3020";
const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "mobile-narrow", width: 320, height: 568 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

const ROUTES = [
  "/app/mapa",
  "/app/hoje",
  "/app/kanban",
  "/app/painel",
  "/app/configuracoes",
  "/app/configuracoes/motor",
  "/app/configuracoes/integracoes",
];

const report = [];
const browser = await chromium.launch();

async function enterApp(page) {
  await page.goto(BASE + "/app/mapa", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const skip = page.getByRole("button", { name: "Explorar sozinho" });
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
    await page.waitForTimeout(1200);
  }
}

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  await enterApp(page);

  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const data = await page.evaluate(() => {
      const innerW = window.innerWidth;
      const doc = document.documentElement;
      const pageOverflow = doc.scrollWidth > innerW + 1;
      const overflowBy = doc.scrollWidth - innerW;

      // Elements whose box sticks out of the viewport horizontally.
      const offenders = [];
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        // Ignore elements inside an explicit horizontal scroll container (kanban).
        const inScroll = el.closest("[class*='overflow-x']");
        if (inScroll) continue;
        if (r.right > innerW + 2 || r.left < -2) {
          const tag = el.tagName.toLowerCase();
          const cls = (el.getAttribute("class") || "").slice(0, 50);
          const txt = (el.textContent || "").trim().slice(0, 30);
          offenders.push({ tag, cls, right: Math.round(r.right), left: Math.round(r.left), txt });
        }
      }
      // Dedupe by class+text, keep the worst offenders (max 12).
      const seen = new Set();
      const unique = [];
      for (const o of offenders) {
        const k = o.cls + "|" + o.txt;
        if (seen.has(k)) continue;
        seen.add(k);
        unique.push(o);
      }

      const mobileNav = !!document.querySelector(
        'nav[aria-label="Navegação principal"].md\\:hidden',
      );
      const navRail = !!document.querySelector(
        'nav[aria-label="Navegação principal"].hidden.md\\:flex',
      );
      return { pageOverflow, overflowBy, offenders: unique.slice(0, 12), mobileNav, navRail };
    });

    report.push({ viewport: vp.name, route, ...data });
  }
  await context.close();
}

await browser.close();
console.log(JSON.stringify(report, null, 2));
