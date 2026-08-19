import { defineConfig } from "@playwright/test";

// Dedicated demo-mode dev server for E2E — kept off the real :3000 dev server
// and the manual :3010 demo launcher so a test run never collides with them.
const APP_URL = process.env.E2E_APP_URL ?? "http://127.0.0.1:3030";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  webServer: process.env.E2E_APP_URL
    ? undefined
    : {
        command:
          "VITE_DATA_MODE=demo NODE_NO_WARNINGS=1 bunx vite dev --port 3030 --strictPort --host 127.0.0.1",
        url: APP_URL,
        timeout: 120_000,
        reuseExistingServer: false,
      },
  use: {
    baseURL: APP_URL,
    trace: "on-first-retry",
    // LOTE 4 (F3/Tarefa 3): maybeFail() injeta ~8% de falha aleatória no
    // serviço demo para DEMONSTRAR estado de erro — valor real, mas
    // indistinguível de regressão sob teste. "nicho escasso" falhava ~1 em 4
    // rodadas por isso, e foi o próprio ruído (não o produto) que custou
    // rodadas de validação nesta sessão.
    // Decisão: desligar só sob e2e, via o kill-switch que já existia no
    // código (services/index.ts já lia localStorage["radar-local:sim-errors"]
    // === "0" — não precisou mudar maybeFail(), só ligar o switch aqui).
    // O launcher de demo manual (:3010, fora deste config) continua sem essa
    // origin pré-semeada, então o estado de erro segue demonstrável de
    // propósito lá — só o caminho de teste (:3030) fica determinístico.
    storageState: {
      cookies: [],
      origins: [
        { origin: APP_URL, localStorage: [{ name: "radar-local:sim-errors", value: "0" }] },
      ],
    },
  },
  reporter: [["list"]],
});
