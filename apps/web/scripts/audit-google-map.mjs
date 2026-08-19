// Google Maps audit — drives the demo app (Google renderer) and verifies the
// map surface text-first: console errors, marker rendering, heatmap overlay,
// popup on click, and view switches.
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3020";
const consoleIssues = [];
const pageErrors = [];

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning")
    consoleIssues.push(`[${m.type()}] ${m.text().slice(0, 200)}`);
});
page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));

const report = {};

await page.goto(BASE + "/app/mapa", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
const skip = page.getByRole("button", { name: "Explorar sozinho" });
if (await skip.isVisible().catch(() => false)) {
  await skip.click();
  await page.waitForTimeout(1500);
}

// 1. Search: niche + region
await page
  .getByRole("combobox")
  .click()
  .catch(() => {});
await page
  .getByRole("option", { name: "Barbearia" })
  .click()
  .catch(() => {});
await page
  .getByRole("button", { name: /Localização/ })
  .click()
  .catch(() => {});
await page
  .getByPlaceholder("Cidade, bairro ou endereço...")
  .fill("Porto Alegre")
  .catch(() => {});
await page
  .getByRole("option", { name: "Porto Alegre, Rio Grande do Sul" })
  .click()
  .catch(() => {});
await page
  .getByRole("button", { name: "Buscar oportunidades" })
  .click()
  .catch(() => {});
await page.waitForTimeout(4000);

report.markers = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll(".gm-style img")];
  const markerImgs = imgs.filter((i) =>
    (i.getAttribute("src") || "").startsWith("data:image/svg+xml"),
  );
  return { gmImgTotal: imgs.length, markerSvgCount: markerImgs.length };
});

// 2. Click a marker → InfoWindow
let popupText = null;
try {
  const marker = page.locator('.gm-style img[src^="data:image/svg+xml"]').first();
  if (await marker.count()) {
    await marker.click({ timeout: 5000 });
    await page.waitForTimeout(1200);
    popupText = await page.evaluate(() => {
      const gm = document.querySelector(".gm-style");
      return gm ? gm.innerText.slice(0, 400) : "";
    });
  }
} catch (e) {
  popupText = "click failed: " + String(e).slice(0, 120);
}
report.popupText = popupText;

// 3. Heatmap view + metric selector + canvas
await page
  .getByRole("button", { name: "Heatmap" })
  .click()
  .catch(() => {});
await page.waitForTimeout(1500);
report.heat = await page.evaluate(() => {
  const canvas = document.querySelector(".gm-style canvas");
  const metric = document.querySelector('[aria-label="Métrica do heatmap"]');
  return {
    canvasPresent: !!canvas,
    canvasSize: canvas ? [canvas.width, canvas.height] : null,
    metricSelector: !!metric,
  };
});

// 4. Regiões view
await page
  .getByRole("button", { name: "Regiões" })
  .click()
  .catch(() => {});
await page.waitForTimeout(1200);
report.territories = await page.evaluate(
  () =>
    document.body.innerText.includes("Regiões") || document.body.innerText.includes("Território"),
);

report.consoleIssues = consoleIssues;
report.pageErrors = pageErrors;

await browser.close();
console.log(JSON.stringify(report, null, 2));
