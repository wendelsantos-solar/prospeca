import { expect, test } from "@playwright/test";

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
  await page.goto("/app/mapa");
  await expect(page.getByText("Buscar empresas")).toBeVisible();

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
  await page.goto("/app/kanban");

  const firstColumn = page.getByTestId("kanban-column-new");
  await expect(firstColumn).toBeVisible();
  const box = await firstColumn.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(340);
  expect(box?.width ?? 999).toBeLessThanOrEqual(390);
});

test("usuário registra o resultado real de uma oportunidade", async ({ page }) => {
  await page.goto("/app/kanban");
  const skipOnboarding = page.getByRole("button", { name: "Pular" });
  await skipOnboarding.waitFor({ state: "visible", timeout: 2_000 }).catch(() => {});
  if (await skipOnboarding.isVisible()) await skipOnboarding.click();

  await page.getByText("Vitalis Medicina", { exact: true }).click();
  await page.getByRole("tab", { name: "Oportunidade" }).click();
  await expect(page.getByText("Por que está priorizada")).toBeVisible();
  await page.getByRole("button", { name: "Resposta recebida" }).click();

  await expect(page.getByText("Resultado comercial registrado.")).toBeVisible();
});
