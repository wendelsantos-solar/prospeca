# Sistema de Ícones V2 — Auditoria

Estado atual dos ícones no Prospeca, levantado em 2025.

## Biblioteca

| Item                          | Status                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| Biblioteca principal          | `lucide-react` ^0.575.0                                                                    |
| Outras bibliotecas de ícones  | Nenhuma detectada                                                                          |
| Emojis Unicode como UI        | `FormattingToolbar.tsx` (seletor de emoji — uso legítimo como conteúdo), `constants.ts:44` |
| Caracteres Unicode como ícone | `map-popup.ts:40` — `✓` (corrigido → SVG inline Check)                                     |
| SVGs customizados             | Nenhum além de marcadores de mapa                                                          |

## Arquivos que importam Lucide

67 arquivos no total em `apps/web/src/`.

## Tamanhos de ícone em uso

| Tamanho  | Tailwind      | Usos        | Conforme spec?                               |
| -------- | ------------- | ----------- | -------------------------------------------- |
| 12px     | `h-3 w-3`     | ~5          | ✅ `xs`                                      |
| 14px     | `h-3.5 w-3.5` | 77          | ✅ `sm`                                      |
| 16px     | `h-4 w-4`     | 58          | ✅ `md` (padrão)                             |
| 18px     | `h-[18px]`    | 0           | ✅ `lg`                                      |
| 20px     | `h-5 w-5`     | 9           | ✅ `xl`                                      |
| 24px     | `h-6 w-6`     | 6           | ✅ `display`                                 |
| **13px** | `h-[13px]`    | 1 (TopNav)  | ❌ fora da escala                            |
| **15px** | `h-[15px]`    | 1 (TopNav)  | ❌ fora da escala                            |
| **19px** | `h-[19px]`    | 3 (NavRail) | ❌ fora da escala → migrado para 16px (`md`) |
| **21px** | `h-[21px]`    | 6 (NavRail) | ❌ fora da escala → migrado para 18px (`lg`) |
| **22px** | `h-[22px]`    | 1 (TopNav)  | ❌ fora da escala                            |

## Stroke em uso

| Valor               | Onde                    | Conforme spec?                                                   |
| ------------------- | ----------------------- | ---------------------------------------------------------------- |
| `2` (padrão Lucide) | Maioria dos componentes | ✅ `strong`                                                      |
| `2.2`               | NavRail ativo + logo    | ❌ fora da escala → migrado para `2` (strong) e `1.75` (regular) |
| `2.5`               | Badges de score         | ❌ fora da escala                                                |
| `1.5`               | Não encontrado          | ✅ `light` (disponível, não usado)                               |

## Cores de ícone

| Padrão                                              | Conforme spec?                                                 |
| --------------------------------------------------- | -------------------------------------------------------------- |
| `text-muted-foreground` para inativo                | ✅                                                             |
| `text-primary` para ativo                           | ✅                                                             |
| `text-destructive` para ações destrutivas           | ✅                                                             |
| `emerald-*` hardcoded (MessageEditor, constants.ts) | ❌ → parcialmente corrigido (MessageEditor já usa `ring-ring`) |

## Acessibilidade

| Item                            | NavRail                      | Demais componentes             |
| ------------------------------- | ---------------------------- | ------------------------------ |
| `aria-label` em botões de ícone | ✅                           | Variável                       |
| Tooltip                         | `title` nativo               | `Tooltip` componente (maioria) |
| `aria-hidden` em decorativos    | ❌                           | ❌                             |
| Área clicável ≥ 32px            | ✅ (44px nav, 32px settings) | Variável                       |

## Componentes criados (Fase 1)

- `src/design-system/icons/icon-registry.ts` — Registro central de ícones
- `src/design-system/icons/AppIcon.tsx` — Componente base (tamanho, stroke, cor, acessibilidade)
- `src/design-system/icons/IconButton.tsx` — Botão de ícone (variantes, loading, disabled, tooltip)
- `src/design-system/icons/index.ts` — Barrel export

## Migração realizada (Fase 2)

- `NavRail.tsx` — Migrado para `AppIcon` + `icon-registry`. Tamanhos padronizados: nav 18px (`lg`), utilidades 16px (`md`), logo 20px (`xl`). Stroke padronizado: 1.75 (`regular`) inativo, 2 (`strong`) ativo.

## Pendente por domínio

Ver `docs/ICON_SYSTEM_V2.md` para o spec completo e `docs/ICON_MIGRATION_MAP.md` para o mapa de equivalência por arquivo.
