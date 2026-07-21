# Relatório de Limpeza de Código

**Branch:** `chore/codebase-cleanup`
**Escopo:** monorepo bun (`apps/web` + `packages/{contracts,domain,geo,providers}` + `supabase/`)
**Abordagem:** conservadora, baseada em evidência. Só remoções de **confiança alta**, cada uma verificada por dois meios independentes (knip + `rg`/grep). Nenhuma mudança funcional.

---

## ⚠️ Contexto importante (baseline)

O repositório está **no meio de um refactor** (branch de origem `refactor/monorepo-lead-platform`, com `backup/pre-monorepo-lead-platform`). Antes de qualquer remoção, o baseline foi medido:

| Verificação         | Estado no baseline | Observação                                                  |
| ------------------- | ------------------ | ----------------------------------------------------------- |
| `bun run build`     | ✅ **passa**       | esbuild/vite não checa tipos                                |
| `bun run typecheck` | ❌ **falha**       | 1 erro pré-existente (ver abaixo)                           |
| `bun run lint`      | ❌ **falha**       | 11 erros prettier (formatação) + 7 warnings `react-refresh` |
| `bun run test`      | —                  | projeto não tem test runner configurado                     |

**Erro pré-existente (NÃO causado pela limpeza):**
`apps/web/src/components/app/SearchForm.tsx:157` — `Cannot find name 'setRadius'`. É um **bug real** (referência a símbolo inexistente) que quebraria em runtime se o caminho executar. Deixado intacto — corrigir é mudança funcional, fora do escopo desta limpeza.

Como o baseline já estava vermelho no typecheck, o critério de segurança usado foi: **build continua passando** e **a contagem de erros de typecheck não aumenta** (permanece exatamente o mesmo erro de `setRadius`).

---

## Resumo

| Métrica                           | Valor                                   |
| --------------------------------- | --------------------------------------- |
| Arquivos removidos                | **31**                                  |
| Linhas removidas                  | **3.527**                               |
| Dependências removidas            | **20**                                  |
| Documentos removidos/consolidados | **0** (todos em revisão manual)         |
| Assets removidos                  | **0** (1 órfão em revisão manual)       |
| Componentes UI removidos          | 27 (shadcn não utilizados)              |
| Redução aproximada                | ~3,5k linhas de TS/TSX + 20 pacotes npm |

---

## Arquivos removidos

Todos com **0 importadores** confirmados (knip + `rg`), formando um subgrafo morto fechado.

| Arquivo                                                                                                                                                                                                                                                                                                        | Motivo                                                     | Evidência de não uso                                                           | Risco                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------- |
| `apps/web/src/components/ui/{accordion,alert-dialog,alert,aspect-ratio,avatar,breadcrumb,calendar,carousel,chart,collapsible,context-menu,drawer,form,hover-card,input-otp,menubar,navigation-menu,pagination,radio-group,resizable,scroll-area,separator,sidebar,sonner,switch,toggle-group,toggle}.tsx` (27) | Componentes shadcn/ui nunca importados                     | knip "unused files" + `rg` por `ui/<nome>` → 0 importadores em arquivos ativos | Baixo (folhas, nada os importa) |
| `apps/web/src/hooks/use-mobile.tsx`                                                                                                                                                                                                                                                                            | Só era importado por `ui/sidebar.tsx` (também removido)    | `rg` → 1 importador (sidebar, morto)                                           | Baixo                           |
| `apps/web/src/lib/map/GoogleMapProvider.ts`                                                                                                                                                                                                                                                                    | Abstração de mapa abandonada; `MapView` usa Leaflet direto | `rg @/lib/map` → 0 fora do próprio dir; `MapView.tsx` não referencia           | Baixo                           |
| `apps/web/src/lib/map/types.ts`                                                                                                                                                                                                                                                                                | Tipos só do provider removido                              | `rg lib/map/types` → 0 importadores                                            | Baixo                           |
| `apps/web/src/lib/phone.ts`                                                                                                                                                                                                                                                                                    | Helper sem consumidores                                    | `rg lib/phone` → 0 importadores                                                | Baixo                           |

**`ui/sonner.tsx`** merece nota: o app renderiza `<Toaster>` importado **direto do pacote `sonner`** em `routes/__root.tsx`, não do wrapper local — por isso o wrapper estava morto.

---

## Dependências removidas

Todas atreladas exclusivamente aos componentes UI removidos, com **0 imports residuais** no código mantido (`rg` por pacote).

| Dependência                       | Componente que a usava (removido) | Validação           |
| --------------------------------- | --------------------------------- | ------------------- |
| `@radix-ui/react-accordion`       | accordion                         | 0 imports residuais |
| `@radix-ui/react-alert-dialog`    | alert-dialog                      | 0                   |
| `@radix-ui/react-aspect-ratio`    | aspect-ratio                      | 0                   |
| `@radix-ui/react-avatar`          | avatar                            | 0                   |
| `@radix-ui/react-collapsible`     | collapsible                       | 0                   |
| `@radix-ui/react-context-menu`    | context-menu                      | 0                   |
| `@radix-ui/react-hover-card`      | hover-card                        | 0                   |
| `@radix-ui/react-menubar`         | menubar                           | 0                   |
| `@radix-ui/react-navigation-menu` | navigation-menu                   | 0                   |
| `@radix-ui/react-radio-group`     | radio-group                       | 0                   |
| `@radix-ui/react-scroll-area`     | scroll-area                       | 0                   |
| `@radix-ui/react-separator`       | separator                         | 0                   |
| `@radix-ui/react-switch`          | switch                            | 0                   |
| `@radix-ui/react-toggle`          | toggle                            | 0                   |
| `@radix-ui/react-toggle-group`    | toggle-group                      | 0                   |
| `embla-carousel-react`            | carousel                          | 0                   |
| `input-otp`                       | input-otp                         | 0                   |
| `react-day-picker`                | calendar                          | 0                   |
| `react-resizable-panels`          | resizable                         | 0                   |
| `vaul`                            | drawer                            | 0                   |

Após remoção: `bun install` (lockfile atualizado) + `bun run build` ✅.

---

## Itens mantidos por segurança (falsos-positivos de scanner)

O knip apontou estes como "não usados", mas são **usados de formas que a análise estática não vê**. Removê-los quebraria o projeto — **mantidos**.

| Item                                       | Por que o knip errou                                                                                             | Evidência de uso real                                                                                                             |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Todas as 24 `supabase/functions/**`\*\*  | Entrypoints Deno invocados por **string** em runtime, não importados estaticamente                               | `rg "invokeFunction\|functions.invoke"` → chamadas em `lib/supabase.ts`, `lib/reverse-geocode.ts`, `routes/app.configuracoes.tsx` |
| `@tanstack/router-plugin`                  | Usado **transitivamente** pelo plugin do TanStack Start (`vite.config.ts` → `@tanstack/react-start/plugin/vite`) | Start puxa o router-plugin internamente                                                                                           |
| `nitro` (devDep)                           | Engine de servidor do TanStack Start; versão **beta pinada** de propósito                                        | Build de produção depende do runtime nitro                                                                                        |
| `@leads/geo` (dep de `packages/providers`) | Dep de workspace ainda não conectada (mid-refactor)                                                              | Ver revisão manual                                                                                                                |

---

## Validações realizadas

Após **cada** grupo de remoções:

- ✅ `bun run build` — passou em todas as etapas
- ✅ `bun run typecheck` — contagem de erros inalterada (só o `setRadius` pré-existente)
- ✅ `bun install` — lockfile consistente, "no changes" nas deps mantidas
- ✅ `rg` cross-check — 0 imports residuais dos itens removidos

**Fluxos manuais NÃO validados no navegador:** modo real exige login (credenciais não podem ser inseridas por mim). Recomenda-se o usuário rodar `bun run dev`, logar e conferir os fluxos principais (busca, mapa, kanban, dashboard, modal de mensagens) — nenhum deles depende dos arquivos removidos (todos eram folhas sem importadores).

---

## Problemas encontrados durante a auditoria

1. **Bug pré-existente:** `SearchForm.tsx:157` referencia `setRadius` inexistente → `TS2552`. Quebraria em runtime. **Recomenda-se corrigir** (provavelmente era `setRadius` de um `useState` removido no refactor).
2. **Baseline vermelho:** typecheck e lint já falhavam antes da limpeza. Recomenda-se estabilizar o baseline (verde) antes de futuras remoções em massa, para que o typecheck sirva de rede de segurança.
3. **Formatação:** 11 erros de prettier pendentes (`services/index.ts`, `stores/index.ts`, `types/index.ts`). `bun run format` resolve — não feito aqui por ser fora do escopo (mudança de formatação, não código morto).

---

## Itens NÃO removidos (aguardando decisão) — ver `CODE_CLEANUP_MANUAL_REVIEW.md`

Docs potencialmente obsoletos, asset órfão (`favicon-512.png`), dep de workspace `@leads/geo`, e o bug `setRadius` estão listados no relatório de revisão manual, com evidência e recomendação para cada um.
