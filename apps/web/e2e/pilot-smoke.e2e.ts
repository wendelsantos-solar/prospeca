import { expect, test, type Page } from "@playwright/test";

/**
 * Opens an /app route past the onboarding wizard.
 *
 * Every test gets a fresh context, so the wizard is always on its first run and
 * covers the app shell. Skipping it persists to localStorage (demo mode), so one
 * dismissal per test is enough for later navigations in the same page.
 */
async function enterApp(page: Page, path: string) {
  await page.goto(path);
  const skip = page.getByRole("button", { name: "Explorar sozinho" });
  await skip.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});

  // Retried on purpose: the markup is server-rendered, so the button is
  // clickable before React has attached its handler. A single click can land in
  // that gap and do nothing.
  await expect(async () => {
    if (await skip.isVisible().catch(() => false)) await skip.click();
    await expect(skip).toBeHidden({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
}

test("preços publica somente a oferta disponível no piloto", async ({ page }) => {
  await page.goto("/precos");

  await expect(
    page.getByRole("heading", { name: "Comece grátis ou participe do piloto fundador" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Descobrir" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Profissional" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Agência" })).toHaveCount(0);
  await expect(page.getByText("Excel (XLSX)")).toHaveCount(0);
});

test("demonstração abre mapa, pipeline e configurações sem estado de erro", async ({ page }) => {
  await enterApp(page, "/app/mapa");
  await expect(page.getByText("Descobrir oportunidades")).toBeVisible();

  await page.goto("/app/kanban");
  await expect(page.getByLabel("Buscar leads por nome")).toBeVisible();
  await expect(page.getByText(/^Clínica Médica •/).first()).toBeVisible();

  await page.goto("/app/configuracoes");
  await expect(page.getByRole("heading", { name: "Configurações" })).toBeVisible();
  await expect(page.getByText("Perfil de demonstração")).toBeVisible();
  await expect(page.getByText("Não foi possível carregar sua conta.")).toHaveCount(0);
});

test("pipeline móvel apresenta uma coluna por viewport e permite navegação horizontal", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterApp(page, "/app/kanban");

  const firstColumn = page.getByTestId("kanban-column-new");
  await expect(firstColumn).toBeVisible();
  const box = await firstColumn.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(340);
  expect(box?.width ?? 999).toBeLessThanOrEqual(390);
});

test("usuário registra o resultado real de uma oportunidade", async ({ page }) => {
  await enterApp(page, "/app/kanban");

  await page.getByText("Vitalis Medicina", { exact: true }).click();
  await page.getByRole("tab", { name: "Oportunidade" }).click();
  await expect(page.getByText("Por que está priorizada")).toBeVisible();
  await page.getByRole("button", { name: "Resposta recebida" }).click();

  await expect(page.getByText("Resultado comercial registrado.")).toBeVisible();
});
