# Radar Local — Frontend Web (SaaS B2B de Prospecção)

Aplicação completa de prospecção de leads locais, 100% frontend com dados mockados e arquitetura preparada para API real.

## Stack

React + TS + Vite (TanStack Start já configurado), Tailwind v4 + shadcn/ui, Lucide, TanStack Query, React Hook Form + Zod, Zustand (com persist), dnd-kit, Recharts, Leaflet + OpenStreetMap, date-fns, Sonner.

## Arquitetura de pastas

```
src/
  routes/           # /app/mapa, /app/kanban, /app/painel, / (landing→redirect)
  features/         # search, leads, map, kanban, dashboard, messaging, history, export
  components/ui/    # shadcn
  components/shared/# EmptyState, ErrorState, LoadingState, MetricCard, etc.
  services/         # *Service com implementação mock + interface pronta para REST
  stores/           # zustand por domínio (search, leads, ui, message, settings)
  mocks/            # 50+ leads, categorias, cidades
  types/            # Lead, Search, Activity, etc.
  lib/              # format (BRL/date), score, storage versionado, constants
  hooks/            # useLeads, useMap, usePipeline, useAnalytics
```

## Design System (src/styles.css)

Tokens oklch: cinza claro base, superfícies brancas, verde primário, laranja (quente), amarelo (morno), cinza-azulado (frio), azul (selecionado), vermelho (erro/descarte). Cantos 8-12px, sombras suaves. Tema claro + escuro persistido. Nome em `src/lib/constants.ts` (`APP_NAME = "Radar Local"`).

## Layout

Sidebar fixa esquerda (360-400px, recolhível/drawer mobile) + área principal com tabs Mapa/Kanban/Painel controladas por rota.

### Sidebar

Header (logo+nome+tema+config+colapso) → SearchForm (combobox nicho, autocomplete localização, slider raio, segmented presença, botão) → SearchProgress (7 etapas) → MainNavigation (3 tabs) → Ações (WhatsApp template modal, Buscas anteriores drawer) → SearchSummary → QuickFilters chips + AdvancedFiltersDrawer + Sort + Export CSV/Excel → LeadList virtualizada.

### Área principal

- **/app/mapa**: Leaflet com marcadores coloridos por temperatura, círculo de raio, clusters, popup rico, seleção sincronizada.
- **/app/kanban**: 5 colunas (Novo/Qualificado/Contatado/Ganho/Descartado), dnd-kit, modais especiais para Ganho e Descarte, barra sticky de filtros, densidade compact/comfortable.
- **/app/painel**: Seletor de período, 14 MetricCards, FunnelChart, 8 gráficos Recharts, tabelas por nicho e cidade com ordenação/paginação.
- **Landing state** (sem busca ativa): título "Encontre sua próxima oportunidade local", benefícios, sugestões clicáveis.

### Drawer de detalhes do lead

Cabeçalho + informações comerciais + análise de oportunidade + composição do score + timeline + notas + próximas atividades.

### Modo prospecção em massa

Barra topo sticky, limite 10, modal de preparação com mensagem personalizada por lead, copiar + abrir WhatsApp (wa.me).

## Score e temperatura

Função pura `calculateScore(lead)` com pesos documentados (sem site +25, WhatsApp +20, nota>4 +10, etc.). Popover explica composição. Temperatura derivada.

## Dados mockados

50+ leads distribuídos em múltiplos nichos/cidades/bairros/estágios/temperaturas, coordenadas próximas às cidades brasileiras, nomes brasileiros variados. Services com delay 300-800ms e chance controlada de erro.

## Persistência (localStorage versionada)

tema, buscas, histórico, filtros, ordenação, estágios/notas/atividades, seleções, template, densidade, período painel, colunas recolhidas, filtros salvos.

## Estados

Loading (skeletons), Empty (com CTAs), Error (retry+voltar), Success (toasts sonner).

## Formatação PT-BR

Helpers centralizados: `formatBRL`, `formatDate`, `formatNumber`, `formatDistance`.

## Responsividade

Desktop (sidebar fixa), Tablet (recolhível), Mobile (drawer + bottom sheet + fullscreen details).

## Acessibilidade

Teclado, foco visível, aria-labels, contraste AA, dnd por teclado, prefers-reduced-motion.

## Ordem de execução (etapas 1→8 do prompt)

Fundação → Busca → Mapa → Detalhes → Kanban → Prospecção em massa → Painel → Refinamento.

## Escopo — o que NÃO faço

Sem backend, sem scraping real, sem API paga, sem envio automático WhatsApp, sem auth real, sem banco. Tudo mock + localStorage.

## Observação sobre volume

Este é um app grande (~60-80 arquivos). Vou entregar em uma única passada estruturada, priorizando funcionalidade completa das interações listadas em §39 e §46 sobre polimento visual extremo — o refinamento visual entra na etapa 8 e pode ter passes adicionais depois se você quiser ajustes específicos.
