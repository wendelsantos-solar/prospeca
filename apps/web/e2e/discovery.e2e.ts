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

test("descoberta: busca por nicho + região → resultados e heatmap", async ({ page }) => {
  await enterApp(page, "/app/mapa");

  // 1. Seleciona o nicho (o select de "result-count" também é combobox).
  await page.getByRole("combobox").filter({ hasText: "Nicho" }).click();
  await page.getByRole("option", { name: "Barbearia" }).click();

  // 2. Seleciona a região (digita pra filtrar as sugestões locais).
  await page.getByRole("button", { name: /Localização/ }).click();
  await page.getByPlaceholder("Cidade, bairro ou endereço...").fill("Porto Alegre");
  await page.getByRole("option", { name: "Porto Alegre, Rio Grande do Sul" }).click();

  // 3. Dispara a busca explicitamente (determinístico — não depende da auto-busca).
  await page.getByRole("button", { name: "Buscar oportunidades" }).click();

  // 4. Resultados (faixa de KPIs) aparecem. O label "Empresas encontradas"
  // existe também no SearchForm (result-count) — mirar no tile de KPI e no
  // progresso de streaming, que só existem com busca concluída.
  await expect(page.getByText(/empresas encontradas até agora/)).toBeVisible({ timeout: 25_000 });

  // 5. Heatmap: seletor de métrica (V2) fica visível.
  await page.getByRole("button", { name: "Heatmap" }).click();
  await expect(page.getByLabel("Métrica do heatmap")).toBeVisible();

  // Regiões: view REMOVIDA da tela por decisão do usuário (Fase remoção) —
  // o TerritoriesView/backend/domínio permanecem, só desacoplados da UI.
});

test("descoberta: card de resultado é selecionável por TECLADO (a11y)", async ({ page }) => {
  await enterApp(page, "/app/mapa");

  // Mesma busca determinística do teste acima.
  await page.getByRole("combobox").filter({ hasText: "Nicho" }).click();
  await page.getByRole("option", { name: "Barbearia" }).click();
  await page.getByRole("button", { name: /Localização/ }).click();
  await page.getByPlaceholder("Cidade, bairro ou endereço...").fill("Porto Alegre");
  await page.getByRole("option", { name: "Porto Alegre, Rio Grande do Sul" }).click();
  await page.getByRole("button", { name: "Buscar oportunidades" }).click();
  await expect(page.getByText(/empresas encontradas até agora/)).toBeVisible({ timeout: 25_000 });

  // O overlay de seleção do DiscoveryCard é um <button> real ("Selecionar <nome>"),
  // e não uma div com onClick — regressão que a Vitrine pegou e o portal dela não
  // conseguiu fechar (o driver não dirige foco). Aqui provamos de ponta a ponta.
  const cards = page.getByRole("button", { name: /^Selecionar / });
  await expect(cards.first()).toBeVisible({ timeout: 15_000 });

  // 1. FOCÁVEL: o card recebe foco programático de teclado (o que uma div não faria).
  const first = cards.first();
  await first.focus();
  await expect(first).toBeFocused();

  // 2. ESTADO EXPOSTO: aria-pressed reflete a seleção, antes e depois.
  await expect(first).toHaveAttribute("aria-pressed", "false");

  // 3. ATIVAÇÃO POR TECLADO: Enter seleciona (sem clique de mouse em momento algum).
  await page.keyboard.press("Enter");
  await expect(first).toHaveAttribute("aria-pressed", "true");

  // 4. ESPAÇO também ativa — contrato nativo de <button> que o fix precisa manter.
  const second = cards.nth(1);
  if (await second.count()) {
    await second.focus();
    await page.keyboard.press(" ");
    await expect(second).toHaveAttribute("aria-pressed", "true");
  }
});
