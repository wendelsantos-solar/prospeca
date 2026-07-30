# Design System V2 — Fatia 1: Fundação + Shell + Mapa

**Branch:** `feat/design-system-v2` · **Data:** 2026-07-27
**Escopo desta fatia:** Fases 0, 1, 2 do redesign. As demais (componentes base/dados, migração das outras páginas, docs/`/design-system`, testes/a11y) virão em specs próprios.

## Objetivo

Reformular a linguagem visual e a **posição** dos elementos do Radar Local, provando a direção V2 end-to-end na tela flagship (Mapa). Não é troca de cor/fonte: é reorganização do shell e da hierarquia. Mockup aprovado: `scratchpad/mapa-v2.html` (artifact publicado).

## Direção visual (aprovada)

Layout de 3 zonas: **rail de navegação (64px)** → **painel busca+resultados (~372px)** → **workspace** (header global + conteúdo).

| Antes                                             | V2                                                                                                       |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Nav primária = tabs no topo, dentro do `TopNav`   | Rail de ícones dedicado à esquerda, com badges de contagem                                               |
| `TopNav` = só tabs + notificações                 | Header global: contexto (cidade / nicho · raio), busca ⌘K (placeholder), toggle Mapa/Lista, notificações |
| Brand + tema + settings no header do `AppSidebar` | Movidos para o rail                                                                                      |
| `AppSidebar` = brand + busca + lista              | Só busca + resultados (header enxuto "Buscar empresas")                                                  |
| `DiscoveryCard` = badge de score plano            | Anel de score, badge de temperatura (cor+texto+ícone), chips de canal, distância em mono                 |
| Marcadores sem linguagem                          | Cor por temperatura, raio desenhado, pin de centro, marcador "no funil" distinto, legenda, popup rico    |

Regras: temperatura **nunca** depende só de cor (texto+ícone junto). Mono só em métricas/distância/IDs. Densidade compacta porém confortável.

## Fase 0 — Fundação de tokens (`apps/web/src/styles.css`)

Manter a base OKLCH atual (já é semântica e boa). **Adicionar**, não substituir:

- `--surface-hover` (hover de superfícies interativas).
- Variantes _soft_ de status: `--info-soft`, `--warning-soft`, `--destructive-soft`, e `--hot-soft/--warm-soft/--cold-soft` (fundos de badge por temperatura).
- Token de seleção `--sel` / `--sel-soft` (hoje reusa `info`).
- Motion: `--motion-fast: 120ms`, `--motion-normal: 180ms`, `--motion-slow: 260ms`; easings `--ease-standard/enter/exit`.
- Z-index: `--z-sticky/dropdown/popover/drawer/modal/toast/tooltip`.
- Expor os novos no bloco `@theme inline` (Tailwind v4) para virarem utilitários.
- Definir em `:root` (light) e `.dark` com contraste validado.

Sem mudança visual aparente nesta fase — é base.

## Fase 1 — Shell + Layout

**Novo `components/app/NavRail.tsx`:** coluna 64px. Brand (mark radar) → nav primária (Mapa/Hoje/Pipeline/Agenda/Análises, +Admin se platform-admin) como `IconButton`s com tooltip + badge de contagem (reusa `useLeadsList`/`buildTodayGroups` do TopNav atual) → spacer → tema (move de AppSidebar) → Settings (`SettingsDialog`) → avatar. Item ativo: fundo `primary-soft` + barra lateral. `aria-current`, `aria-label` em todos.

**`routes/app.tsx`:** grid `[64px] [painel] [1fr]`. Ordem: `<NavRail/> <AppSidebar/> <main><TopNav/><Outlet/></main>`. `MobileNav` mantido (bottom tabs). Comportamento de colapso do painel preservado (`sidebarCollapsed`).

**`components/app/TopNav.tsx` → header global:** remove as tabs (foram pro rail). Passa a mostrar: botão expandir painel (quando colapsado) + contexto/breadcrumb da busca atual (cidade · nicho · raio) + campo ⌘K (placeholder visual, sem command palette funcional ainda) + view toggle Mapa/Lista (Mapa navega `/app/mapa`, Lista idem com querystring `?view=list` — só visual por ora) + `NotificationsPopover`.

**`components/app/AppSidebar.tsx`:** remove o bloco de brand/tema/settings do header (foi pro rail). Header vira título "Buscar empresas" + subtítulo + `HistoryDrawer`. Corpo (SearchForm/summary/toolbar/lista) inalterado em lógica.

Nenhuma regra de negócio muda. Nenhum store novo. Nenhum dado mockado.

## Fase 2 — Mapa flagship

**`DiscoveryCard.tsx`:** anel de score conic-gradient colorido por temperatura; badge de temperatura (`hot/warm/cold` com token soft + ícone + label); chips de canal (telefone/site/whatsapp) com estado has/no; distância em `.mono`; ações no hover (Adicionar ao funil / WhatsApp / Detalhes). Lógica de ações intacta.

**`SearchForm.tsx`:** restyle para casar com o painel (campos, slider de raio, segmented de presença) reusando os novos tokens. Lógica intacta.

**Mapa (`LeafletMapView.tsx`, `GoogleMapView.tsx`, `map-popup.ts`):** marcadores coloridos por temperatura via tokens; marcador selecionado com anel; marcador "no funil" com contorno; raio desenhado; legenda flutuante; popup rico (score, avaliação, presença, ações). Ajustar só a camada visual dos marcadores/popup.

## Não-objetivos desta fatia

- Command palette funcional (⌘K é placeholder visual).
- Migrar Hoje/Pipeline/Agenda/Análises/Admin/Config (fase futura).
- Página `/design-system`, testes de componente, auditoria WCAG completa (fases futuras).
- Tornar o painel de busca exclusivo do Mapa (decisão de produto separada — hoje é global/colapsável, mantido).

## Verificação

- `bun test` verde (runner é bun; `apps/web` não tem script de teste próprio).
- Build TS sem erro; preview do dev server no `/app/mapa`, screenshots light+dark.
- Um commit por fase, todos em `feat/design-system-v2`.
