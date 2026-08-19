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
  await expect(page.getByText(/empresas analisadas até agora/)).toBeVisible({ timeout: 25_000 });

  // 5. Heatmap: seletor de métrica (V2) fica visível.
  await page.getByRole("button", { name: "Heatmap" }).click();
  await expect(page.getByLabel("Métrica do heatmap")).toBeVisible();

  // Regiões: view REMOVIDA da tela por decisão do usuário (Fase remoção) —
  // o TerritoriesView/backend/domínio permanecem, só desacoplados da UI.
});

test("descoberta: nicho escasso numa cidade dá vazio HONESTO — sem contadores discordando", async ({
  page,
}) => {
  await enterApp(page, "/app/mapa");

  // Mesmo cenário do achado original da Vitrine (Restaurante + São Paulo +
  // 10km; MOCK_LEADS não tem Restaurante em SP, o mais próximo está no Rio a
  // ~360km), mas o CRITÉRIO mudou com a decisão do usuário (FIX-P0-RAIO:
  // raio duro). Antes o serviço "resgatava" os de fora do raio e o
  // filterByRadius do cliente reapagava — toast dizia 6, tela mostrava 0.
  // Agora o esperado é vazio de verdade, explicado, com os contadores
  // concordando. Este teste trava a COMPOSIÇÃO (serviço + filtro + render),
  // que é onde o defeito vivia — o serviço isolado já passava antes.
  await page.getByRole("combobox").filter({ hasText: "Nicho" }).click();
  await page.getByRole("option", { name: "Restaurante" }).click();
  await page.getByRole("button", { name: /Localização/ }).click();
  await page.getByPlaceholder("Cidade, bairro ou endereço...").fill("São Paulo");
  await page.getByRole("option", { name: "São Paulo, São Paulo" }).click();
  await page.getByRole("button", { name: "Buscar oportunidades" }).click();

  // 1. O toast final NÃO pode prometer empresas que a tela não mostra.
  await expect(page.getByText("0 empresas encontradas")).toBeVisible({ timeout: 25_000 });

  // 2. A copy antiga, que mentia ("aumente o raio" não resolvia nada quando o
  //    mais próximo está a centenas de km), não pode voltar.
  await expect(page.getByText("Nada dentro do raio")).toHaveCount(0);

  // 3. O vazio explica ONDE está a mais próxima e a que distância.
  await expect(page.getByText(/A mais próxima está em .+, a [\d.,]+ km/).first()).toBeVisible({
    timeout: 10_000,
  });

  // 4. Nenhum card renderizado — lista e contador concordam em ZERO.
  await expect(page.getByRole("button", { name: /^Selecionar / })).toHaveCount(0);
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
  await expect(page.getByText(/empresas analisadas até agora/)).toBeVisible({ timeout: 25_000 });

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

test("descoberta: Cmd+K abre o palette em /app/mapa e navega para Histórico", async ({ page }) => {
  // LOTE 2, Tarefa 3 / achado F4: o listener de Cmd+K sempre rodou em
  // /app/mapa, mas <CommandPalette> ficava preso atrás do early return do
  // TopNav (que se oculta inteiro nessa rota) — a tecla alternava estado e
  // nada renderizava. /app/agenda e /app/historico não têm nenhum <Link> no
  // código; só eram alcançáveis pelo palette, e portanto inalcançáveis a
  // partir da tela inicial. Este teste trava a composição (não só o listener).
  await enterApp(page, "/app/mapa");

  await expect(page.getByPlaceholder("Buscar páginas, nichos…")).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+k");
  const input = page.getByPlaceholder("Buscar páginas, nichos…");
  await expect(input).toBeVisible({ timeout: 5_000 });

  await input.fill("histórico");
  await page.getByText("Histórico de buscas").click();

  await expect(page).toHaveURL(/\/app\/historico$/);
  // Fechou sozinho ao navegar — não fica um palette órfão sobre a nova rota.
  await expect(page.getByPlaceholder("Buscar páginas, nichos…")).toHaveCount(0);
});

test("descoberta: ação de ampliar raio aparece e funciona (cenário alcançável, LOTE 2 Tarefa 2)", async ({
  page,
}) => {
  // Barbearia + São Paulo + raio padrão (10km): a fixture ganhou uma
  // barbearia em Guarulhos (~16km) especificamente para que "Buscar num raio
  // maior" tenha um cenário real, alcançável (dentro do teto de 50km) — sem
  // isso a ação nunca aparecia no demo (achado F6).
  await enterApp(page, "/app/mapa");

  await page.getByRole("combobox").filter({ hasText: "Nicho" }).click();
  await page.getByRole("option", { name: "Barbearia" }).click();
  await page.getByRole("button", { name: /Localização/ }).click();
  await page.getByPlaceholder("Cidade, bairro ou endereço...").fill("São Paulo");
  await page.getByRole("option", { name: "São Paulo, São Paulo" }).click();
  await page.getByRole("button", { name: "Buscar oportunidades" }).click();

  await expect(page.getByText("0 empresas encontradas")).toBeVisible({ timeout: 25_000 });

  const expandButton = page.getByRole("button", { name: /^Buscar num raio de \d+ km$/ });
  await expect(expandButton.first()).toBeVisible({ timeout: 10_000 });
  await expandButton.first().click();

  // A busca refaz sozinha e o resultado passa a existir — a mesma barbearia
  // de Guarulhos que justificou o botão.
  await expect(page.getByText(/^\d+ empresas? encontrada?s?$/)).toBeVisible({ timeout: 25_000 });
  await expect(page.getByRole("button", { name: /^Selecionar / }).first()).toBeVisible({
    timeout: 5_000,
  });
  // E o raio visível reflete o valor realmente usado — não pode divergir (a
  // mesma regra dura do estado do slider). Aparece em 2 lugares (badge do
  // SearchForm + contexto da missão) e os DOIS concordam com "20 km".
  await expect(page.getByText("20 km", { exact: true })).toHaveCount(2);
});

