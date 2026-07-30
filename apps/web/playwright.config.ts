// Configuração do Playwright (testes E2E).
//
// `@playwright/test` NÃO está instalado por padrão — os E2E não rodam no gate
// de CI ainda. Para habilitar:
//   bun add -D @playwright/test && bunx playwright install chromium
//   bunx playwright test
//
// `testMatch` usa `*.e2e.ts` (não `*.spec.ts`) de propósito: `bun test` varre o
// monorepo e captura `*.spec.ts` como teste unitário, tentava importar
// `@playwright/test` e quebrava o gate com
// "Cannot find module '@playwright/test'". A extensão `.e2e.ts` fica fora do
// matcher do bun.
import { defineConfig } from "@playwright/test";

const APP_URL = process.env.E2E_APP_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  // Isolamento cross-tenant não pode rodar em paralelo com estado compartilhado
  // de sessão: um worker por vez até os testes criarem os próprios fixtures.
  workers: 1,
  fullyParallel: false,
  // Nunca reaproveitar credencial de produção nos E2E: aponte E2E_APP_URL e as
  // contas de teste para staging (ver docs/ENVIRONMENTS.md).
  use: {
    baseURL: APP_URL,
    trace: "on-first-retry",
  },
  reporter: [["list"]],
});
