import { test, expect, type Page } from "@playwright/test";

// E2E do fluxo de descoberta em modo demo (VITE_DATA_MODE=demo).
// Sem rede externa: os dados vêm de MOCK_LEADS via DemoSearchRepository.

/** Pula o wizard de onboarding ("Explorar sozinho"), como no pilot-smoke. */
async function enterApp(page: Page, path: string) {
  await page.goto(path);
  const skip = page.getByRole("button", { name: "Explorar sozinho" });
  await skip.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
  await expect(async () => {
    if (await skip.isVisible().catch(() => false)) await skip.click();
    await expect(skip).toBeHidden({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
}

test("descoberta: busca por nicho + região → resultados, heatmap e regiões", async ({ page }) => {
  await enterApp(page, "/app/mapa");

  // 1. Seleciona o nicho.
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Barbearia" }).click();

  // 2. Seleciona a região (digita pra filtrar as sugestões locais).
  await page.getByRole("button", { name: /Localização/ }).click();
  await page.getByPlaceholder("Cidade, bairro ou endereço...").fill("Porto Alegre");
  await page.getByRole("option", { name: "Porto Alegre, Rio Grande do Sul" }).click();

  // 3. Dispara a busca explicitamente (determinístico — não depende da auto-busca).
  await page.getByRole("button", { name: "Buscar oportunidades" }).click();

  // 4. Resultados (faixa de KPIs) aparecem.
  await expect(page.getByText("Empresas encontradas")).toBeVisible({ timeout: 25_000 });

  // 5. Heatmap: seletor de métrica (V2) fica visível.
  await page.getByRole("button", { name: "Heatmap" }).click();
  await expect(page.getByLabel("Métrica do heatmap")).toBeVisible();

  // 6. Regiões: view territorial (V2) fica ativa.
  await page.getByRole("button", { name: "Regiões" }).click();
  await expect(page.getByRole("button", { name: "Regiões" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
