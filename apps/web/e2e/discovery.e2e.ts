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
  // SearchForm + legenda do mapa) e os DOIS concordam com "20 km". A legenda
  // só existe com o mapa montado (FASE C: default agora é Lista) — troca de
  // view explícita para exercitar o segundo local.
  await page
    .getByRole("group", { name: "Alternar visualização" })
    .getByRole("button", {
      name: "Mapa",
    })
    .click();
  await expect(page.getByText("20 km", { exact: true })).toHaveCount(2);
});

test("LOTE 4 (F2): salvar missão persiste e aparece em /app/historico", async ({ page }) => {
  // O stub de demo era um no-op declarado: a UI disparava
  // toast.success("Busca salva como missão") mesmo sem nada persistir, e
  // /app/historico > Buscas salvas nunca mostrava o que "foi salvo" — foi
  // exatamente isso que a Vitrine não viu ao validar o LOTE 2.
  await enterApp(page, "/app/mapa");

  await page.getByRole("combobox").filter({ hasText: "Nicho" }).click();
  await page.getByRole("option", { name: "Barbearia" }).click();
  await page.getByRole("button", { name: /Localização/ }).click();
  await page.getByPlaceholder("Cidade, bairro ou endereço...").fill("Porto Alegre");
  await page.getByRole("option", { name: "Porto Alegre, Rio Grande do Sul" }).click();
  await page.getByRole("button", { name: "Buscar oportunidades" }).click();
  await expect(page.getByText(/empresas analisadas até agora/)).toBeVisible({ timeout: 25_000 });

  await page.getByRole("button", { name: "Salvar busca como missão" }).click();
  const nameInput = page.getByPlaceholder("Nome para salvar a missão");
  await nameInput.fill("Missão E2E Barbearia POA");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Busca salva como missão")).toBeVisible({ timeout: 5_000 });

  // Navegação client-side (não page.goto): o demo guarda o que foi salvo em
  // memória de módulo, não em storage — um reload de página descartaria o
  // estado, o que seria um FALSO negativo do teste, não um defeito real.
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByPlaceholder("Buscar páginas, nichos…").fill("histórico");
  await page.getByRole("option", { name: "Histórico de buscas" }).click();
  await expect(page).toHaveURL(/\/app\/historico$/);
  await expect(page.getByText("Missão E2E Barbearia POA")).toBeVisible({ timeout: 10_000 });
});

test("LOTE 4 (F1): badge do heatmap concorda com a lista após interagir com o mapa", async ({
  page,
}) => {
  // GoogleMapView/LeafletMapView: em heatmap não existem markers (a troca de
  // modo os limpa e fixa o badge em results.length), mas o listener de
  // idle/moveend reconta a partir de markersRef — vazio nesse modo — e
  // zerava o número no primeiro pan/zoom. "2 de 2" virava "0 de 2" mesmo com
  // a lista mostrando 2, o mesmo defeito de contador-vs-tela do P0 do raio.
  await enterApp(page, "/app/mapa");

  await page.getByRole("combobox").filter({ hasText: "Nicho" }).click();
  await page.getByRole("option", { name: "Barbearia" }).click();
  await page.getByRole("button", { name: /Localização/ }).click();
  await page.getByPlaceholder("Cidade, bairro ou endereço...").fill("Porto Alegre");
  await page.getByRole("option", { name: "Porto Alegre, Rio Grande do Sul" }).click();
  await page.getByRole("button", { name: "Buscar oportunidades" }).click();
  await expect(page.getByText(/empresas analisadas até agora/)).toBeVisible({ timeout: 25_000 });

  await page.getByRole("button", { name: "Heatmap" }).click();
  await expect(page.getByLabel("Métrica do heatmap")).toBeVisible();

  const badge = page.getByText(/de \d+ no raio/);
  await expect(badge).toBeVisible({ timeout: 10_000 });
  const before = await badge.innerText();

  // Pan+zoom no mapa — dispara idle/moveend, o gatilho exato do defeito.
  const map = page.locator(".gm-style, .leaflet-container").first();
  await map.hover();
  await page.mouse.wheel(0, -200);
  await page.waitForTimeout(600);

  const after = await badge.innerText();
  expect(after).toBe(before);
  expect(after).not.toMatch(/^0 de/);
});

test("LOTE 4B: cache velho de /app/historico não esconde missão recém-salva (sem reload)", async ({
  page,
}) => {
  // Regressão real, pega DUAS VEZES com gate verde antes desta guarda:
  // 1ª vez (LOTE 4) — persistência nunca acontecia (stub no-op). Consertada,
  // mas o teste de unidade que provou isso não provava o que o USUÁRIO via.
  // 2ª vez (LOTE 4B) — persistência OK, mas nenhum handler de salvar chamava
  // invalidateQueries; a query ["searches","saved"] (staleTime 5min,
  // refetchOnWindowFocus:false — router.tsx) fica presa no cache VAZIO para
  // quem já tinha visitado /app/historico antes de salvar. Sem essa visita
  // PRÉVIA — que cria o cache velho — este cenário não reproduz: um teste
  // que só salva e navega direto ao histórico passaria mesmo com o bug de
  // volta. A visita inicial abaixo é o passo que fecha essa lacuna.
  await enterApp(page, "/app/historico");
  await expect(page.getByText("Nenhuma missão salva ainda.")).toBeVisible({ timeout: 10_000 });

  // Client-side (não page.goto) — precisa ser a MESMA sessão de query cache
  // que acabou de visitar o histórico, senão o cache velho nunca se forma.
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByPlaceholder("Buscar páginas, nichos…").fill("Mapa");
  await page.getByRole("option", { name: "Mapa", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/mapa$/);

  const missionName = "Missão guarda 4B";
  await page.getByRole("combobox").filter({ hasText: "Nicho" }).click();
  await page.getByRole("option", { name: "Barbearia" }).click();
  await page.getByRole("button", { name: /Localização/ }).click();
  await page.getByPlaceholder("Cidade, bairro ou endereço...").fill("Porto Alegre");
  await page.getByRole("option", { name: "Porto Alegre, Rio Grande do Sul" }).click();
  await page.getByRole("button", { name: "Buscar oportunidades" }).click();
  await expect(page.getByText(/empresas analisadas até agora/)).toBeVisible({ timeout: 25_000 });

  await page.getByRole("button", { name: "Salvar busca como missão" }).click();
  await page.getByPlaceholder("Nome para salvar a missão").fill(missionName);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Busca salva como missão")).toBeVisible({ timeout: 5_000 });

  // Volta ao histórico client-side — SEM reload de página. Se a query velha
  // não foi invalidada, este é exatamente o momento em que o cache de 5min
  // esconderia a missão que acabou de ser salva.
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByPlaceholder("Buscar páginas, nichos…").fill("histórico");
  await page.getByRole("option", { name: "Histórico de buscas" }).click();
  await expect(page).toHaveURL(/\/app\/historico$/);

  await expect(page.getByText(missionName)).toBeVisible({ timeout: 5_000 });
});

test("FASE C: entrar sem storage prévio cai na LISTA (não no mapa); seletor funciona nos dois sentidos", async ({
  page,
}) => {
  // A promessa da landing é "quem abordar primeiro e por quê" — a lista
  // responde isso (score em anel + motivo por card); o mapa responde "onde
  // estão". Este teste prova o DEFAULT para quem nunca usou o produto — sem
  // nenhum blob de discoveryView em localStorage (playwright.config.ts só
  // pré-semeia "radar-local:sim-errors", não discoveryView).
  await enterApp(page, "/app/mapa");

  await page.getByRole("combobox").filter({ hasText: "Nicho" }).click();
  await page.getByRole("option", { name: "Barbearia" }).click();
  await page.getByRole("button", { name: /Localização/ }).click();
  await page.getByPlaceholder("Cidade, bairro ou endereço...").fill("Porto Alegre");
  await page.getByRole("option", { name: "Porto Alegre, Rio Grande do Sul" }).click();
  await page.getByRole("button", { name: "Buscar oportunidades" }).click();
  await expect(page.getByText(/empresas analisadas até agora/)).toBeVisible({ timeout: 25_000 });

  const toggle = page.getByRole("group", { name: "Alternar visualização" });
  const listBtn = toggle.getByRole("button", { name: "Lista" });
  const mapBtn = toggle.getByRole("button", { name: "Mapa" });
  const heatmapBtn = toggle.getByRole("button", { name: "Heatmap" });

  // 1. Default: Lista ativa, mapa NÃO renderizado.
  await expect(listBtn).toHaveAttribute("aria-pressed", "true");
  await expect(mapBtn).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".gm-style, .leaflet-container")).toHaveCount(0);

  // 2. Lista → Mapa: o mapa aparece, o botão troca de estado.
  await mapBtn.click();
  await expect(mapBtn).toHaveAttribute("aria-pressed", "true");
  await expect(listBtn).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".gm-style, .leaflet-container").first()).toBeVisible({
    timeout: 10_000,
  });

  // 3. Mapa → Heatmap → Lista: o seletor continua respondendo nos dois sentidos.
  await heatmapBtn.click();
  await expect(heatmapBtn).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Métrica do heatmap")).toBeVisible();

  await listBtn.click();
  await expect(listBtn).toHaveAttribute("aria-pressed", "true");
  await expect(heatmapBtn).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".gm-style, .leaflet-container")).toHaveCount(0);
});

test("FASE C: preferência salva (discoveryView='map', blob v3 existente) sobrevive ao novo default", async ({
  page,
}) => {
  // Simula usuário que já usa o produto: blob v3 com discoveryView='map' já
  // persistido. Versão bate com a atual (3) — persist NEM CHAMA migrate()
  // neste caso (zustand só migra quando a versão do blob é diferente da
  // atual); a troca do literal em create() não pode alcançar esse usuário.
  await page.addInitScript(() => {
    localStorage.setItem(
      "radar-local/v1:ui",
      JSON.stringify({
        state: { discoveryView: "map", navMode: "auto" },
        version: 3,
      }),
    );
  });

  await enterApp(page, "/app/mapa");
  await page.getByRole("combobox").filter({ hasText: "Nicho" }).click();
  await page.getByRole("option", { name: "Barbearia" }).click();
  await page.getByRole("button", { name: /Localização/ }).click();
  await page.getByPlaceholder("Cidade, bairro ou endereço...").fill("Porto Alegre");
  await page.getByRole("option", { name: "Porto Alegre, Rio Grande do Sul" }).click();
  await page.getByRole("button", { name: "Buscar oportunidades" }).click();
  await expect(page.getByText(/empresas analisadas até agora/)).toBeVisible({ timeout: 25_000 });

  const toggle = page.getByRole("group", { name: "Alternar visualização" });
  await expect(toggle.getByRole("button", { name: "Mapa" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(toggle.getByRole("button", { name: "Lista" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});
