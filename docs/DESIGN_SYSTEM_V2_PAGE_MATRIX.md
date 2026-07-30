# Design System V2 — Matriz de Cobertura

Auditoria de todas as páginas e componentes do Radar Local.
Status: `✅` migrado | `🔄` em migração | `📋` fundação pronta | `⬜` não auditado | `🔒` bloqueado

## App Shell

| Página           | Rota            | Componentes                         | Estado atual                                   | Padrão V2                                     | Status |
| ---------------- | --------------- | ----------------------------------- | ---------------------------------------------- | --------------------------------------------- | ------ |
| Layout principal | `/app`          | NavRail, TopNav, AppSidebar, Outlet | Estrutura sólida, rail 64px, sidebar 360-400px | ✅ Tokens ok, ícones ok, espaçamento ok       | ✅     |
| Mobile nav       | `/app` (mobile) | Sheet + NavLinks                    | Sidebar mobile funcional                       | ✅ Usa tokens, ícones precisam de verificação | ✅     |

## Navegação principal

| Área          | Rota                 | Página                  | Componentes principais                                                            | Estado atual                                      | Status |
| ------------- | -------------------- | ----------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------- | ------ |
| Mapa          | `/app/mapa`          | `app.mapa.tsx`          | MapView (Leaflet/Google), AppSidebar com SearchForm + ResultsList + DiscoveryCard | Estrutura definida, marcadores revisados na V2    | ✅     |
| Hoje          | `/app/hoje`          | `app.hoje.tsx`          | Lista de itens (overdue/today/first_reach), modo foco, ActivityItem, NbaCard      | ✅ Migrado ao AppIcon + registry                  | ✅     |
| Pipeline      | `/app/kanban`        | `app.kanban.tsx`        | KanbanBoard, KanbanCard, colunas, drag-and-drop                                   | Cards revisados (ações hover-gated), tokens stage | ✅     |
| Agenda        | `/app/agenda`        | `app.agenda.tsx`        | Tabs (today/upcoming/overdue/completed), ActivityItem                             | ✅ Migrado ao AppIcon + registry                  | ✅     |
| Análises      | `/app/painel`        | `app.painel.tsx`        | Dashboard (lazy), MetricCards, gráficos Recharts                                  | Cards hierárquicos (lg/default), vazio tratado    | ✅     |
| Administração | `/app/admin`         | `app.admin.tsx`         | DataTable, MetricCards, gráfico de custos, HealthRow                              | Revisado (cards, duplicação removida)             | ✅     |
| Configurações | `/app/configuracoes` | `app.configuracoes.tsx` | 8 seções, nav lateral desktop, formulários                                        | Consolidado de 2 telas fragmentadas               | ✅     |
| Histórico     | `/app/historico`     | `app.historico.tsx`     | Lista de buscas passadas, EmptyState                                              | Simples, usa tokens e EmptyState                  | ✅     |

## Autenticação

| Página          | Rota               | Componentes                    | Estado atual                      | Status |
| --------------- | ------------------ | ------------------------------ | --------------------------------- | ------ |
| Login           | `/login`           | AuthCard, Input, Button, Label | ✅ Logo padronizado, usa tokens   | ✅     |
| Cadastro        | `/cadastro`        | AuthCard, Input, Button, Label | ✅ Ícone Check migrado ao AppIcon | ✅     |
| Recuperar senha | `/recuperar-senha` | AuthCard, Input, Button        | ✅ Usa tokens, AuthCard migrado   | ✅     |
| Redefinir senha | `/redefinir-senha` | AuthCard, Input, Button        | ✅ Usa tokens, AuthCard migrado   | ✅     |

## Site público

| Página       | Rota      | Componentes                              | Estado atual                 | Status |
| ------------ | --------- | ---------------------------------------- | ---------------------------- | ------ |
| Landing page | `/`       | LandingPage + 20+ sections               | Narrativa comercial completa | 📋     |
| Preços       | `/precos` | PricingPage, PlanCard, PricingComparison | Tabela de planos, FAQ, CTA   | 📋     |

## Componentes compartilhados (shared)

| Componente | Arquivo          | Função                                              | Estado V2                                   | Status |
| ---------- | ---------------- | --------------------------------------------------- | ------------------------------------------- | ------ |
| Badges     | `Badges.tsx`     | TemperatureBadge, ScorePill, ScoreBadge             | Migrado ao AppIcon, tokens ok               | ✅     |
| DataTable  | `DataTable.tsx`  | Tabela genérica com ordenação, paginação, densidade | ✅ Migrado ao AppIcon                       | ✅     |
| EmptyState | `EmptyState.tsx` | Ícone + título + descrição + ação                   | Usa LucideIcon como prop genérico (correto) | ✅     |
| ErrorState | `ErrorState.tsx` | Ícone + mensagem + botão de retry                   | ✅ Migrado ao AppIcon                       | ✅     |
| Skeletons  | `Skeletons.tsx`  | Loading skeletons (LeadCard, Summary, List)         | Funcional, usa Skeleton UI                  | ✅     |

## Componentes de UI (shadcn/ui)

| Componente    | Arquivo             | Ícones usados                          | Status |
| ------------- | ------------------- | -------------------------------------- | ------ |
| badge         | `badge.tsx`         | —                                      | ✅     |
| button        | `button.tsx`        | —                                      | ✅     |
| card          | `card.tsx`          | —                                      | ✅     |
| checkbox      | `checkbox.tsx`      | Check (Lucide)                         | 📋     |
| command       | `command.tsx`       | Search (Lucide)                        | 📋     |
| dialog        | `dialog.tsx`        | X (Lucide)                             | 📋     |
| dropdown-menu | `dropdown-menu.tsx` | Check, ChevronRight, Circle (Lucide)   | 📋     |
| input         | `input.tsx`         | —                                      | ✅     |
| label         | `label.tsx`         | —                                      | ✅     |
| popover       | `popover.tsx`       | —                                      | ✅     |
| progress      | `progress.tsx`      | —                                      | ✅     |
| select        | `select.tsx`        | Check, ChevronDown, ChevronUp (Lucide) | 📋     |
| sheet         | `sheet.tsx`         | X (Lucide)                             | 📋     |
| skeleton      | `skeleton.tsx`      | —                                      | ✅     |
| slider        | `slider.tsx`        | —                                      | ✅     |
| table         | `table.tsx`         | —                                      | ✅     |
| tabs          | `tabs.tsx`          | —                                      | ✅     |
| textarea      | `textarea.tsx`      | —                                      | ✅     |
| tooltip       | `tooltip.tsx`       | —                                      | ✅     |

## Componentes de app

| Componente            | Arquivo                     | Ícones                           | Estado V2                     | Status |
| --------------------- | --------------------------- | -------------------------------- | ----------------------------- | ------ |
| ActivityItem          | `ActivityItem.tsx`          | Lucide diretos                   | Precisa de migração de ícones | 📋     |
| AppSidebar            | `AppSidebar.tsx`            | Lucide diretos + props           | Complexo (ícones como props)  | 📋     |
| BulkBar               | `BulkBar.tsx`               | Lucide diretos                   | Precisa de migração           | 📋     |
| CommandPalette        | `CommandPalette.tsx`        | Lucide diretos + LucideIcon type | NAV_ITEMS tipado              | 📋     |
| Dashboard             | `Dashboard.tsx`             | Lucide diretos + Recharts        | Cards já revisados            | 📋     |
| DiscoveryCard         | `DiscoveryCard.tsx`         | Lucide diretos                   | Card principal de descoberta  | 📋     |
| Filters               | `Filters.tsx`               | Lucide diretos                   | Precisa de migração           | 📋     |
| GoogleMapView         | `GoogleMapView.tsx`         | Lucide diretos                   | Controles do mapa             | 📋     |
| HistoryDrawer         | `HistoryDrawer.tsx`         | Lucide diretos                   | Drawer de histórico           | 📋     |
| KanbanBoard           | `KanbanBoard.tsx`           | Lucide diretos + props           | Complexo, ícones como props   | 📋     |
| LeadDetailsDrawer     | `LeadDetailsDrawer.tsx`     | 27 Lucide diretos                | Parcialmente migrado          | 🔄     |
| LeafletMapView        | `LeafletMapView.tsx`        | Lucide diretos                   | Controles do mapa             | 📋     |
| LocationPrompt        | `LocationPrompt.tsx`        | Lucide diretos                   | Prompt de geolocalização      | 📋     |
| MapView               | `MapView.tsx`               | Lucide diretos                   | Wrapper de mapa               | 📋     |
| MessageTemplateDialog | `MessageTemplateDialog.tsx` | Lucide diretos                   | Diálogo de template           | 📋     |
| NavRail               | `NavRail.tsx`               | AppIcon + registry               | ✅ Migrado                    | ✅     |
| NbaCard               | `NbaCard.tsx`               | Lucide diretos                   | Card de próxima ação          | 📋     |
| NotificationsPopover  | `NotificationsPopover.tsx`  | Lucide diretos                   | Sininho + lista               | 📋     |
| PrepareMessageDialog  | `PrepareMessageDialog.tsx`  | Lucide diretos                   | Preparar mensagem             | 📋     |
| RadarPill             | `RadarPill.tsx`             | Lucide diretos                   | Pill de score                 | 📋     |
| ResultsList           | `ResultsList.tsx`           | Lucide diretos                   | Tabela/lista de resultados    | 📋     |
| SavedFiltersBar       | `SavedFiltersBar.tsx`       | Lucide diretos                   | Filtros salvos                | 📋     |
| SearchForm            | `SearchForm.tsx`            | Lucide diretos                   | Formulário de busca           | 📋     |
| StageDialogs          | `StageDialogs.tsx`          | Lucide diretos                   | Diálogos Won/Discard          | 📋     |
| TopNav                | `TopNav.tsx`                | AppIcon + registry               | ✅ Migrado                    | ✅     |
| UsageCostCard         | `UsageCostCard.tsx`         | Lucide diretos                   | Card de custo/consumo         | 📋     |

## Message template (sub-componentes)

| Componente             | Arquivo                      | Estado V2                      | Status |
| ---------------------- | ---------------------------- | ------------------------------ | ------ |
| MessageTemplateModal   | `MessageTemplateModal.tsx`   | Split 58/42, tokens ok         | ✅     |
| MessageEditor          | `MessageEditor.tsx`          | Token ring ok                  | ✅     |
| MessageTemplateHeader  | `MessageTemplateHeader.tsx`  | Lucide diretos                 | 📋     |
| TemplateFooter         | `TemplateFooter.tsx`         | Lucide diretos                 | 📋     |
| VariableSection        | `VariableSection.tsx`        | Lucide diretos                 | 📋     |
| PreviewPanel           | `PreviewPanel.tsx`           | Lucide diretos                 | 📋     |
| FormattingToolbar      | `FormattingToolbar.tsx`      | Lucide diretos, emoji conteúdo | 📋     |
| ConversationPreview    | `ConversationPreview.tsx`    | Cores WhatsApp (exceção)       | ✅     |
| PersonalizationSummary | `PersonalizationSummary.tsx` | ✅ Migrado ao AppIcon          | ✅     |
| constants              | `constants.ts`               | Cores hardcoded removidas      | ✅     |

## Marketing / Landing page

| Componente          | Arquivo                   | Estado                | Status |
| ------------------- | ------------------------- | --------------------- | ------ |
| LandingPage         | `LandingPage.tsx`         | Montagem das sections | 📋     |
| HeroSection         | `HeroSection.tsx`         | Hero com CTA          | 📋     |
| TrustStrip          | `TrustStrip.tsx`          | Faixa de confiança    | 📋     |
| ProblemSection      | `ProblemSection.tsx`      | Problema/solução      | 📋     |
| HowItWorksSection   | `HowItWorksSection.tsx`   | Passo a passo         | 📋     |
| BenefitsSection     | `BenefitsSection.tsx`     | Benefícios            | 📋     |
| OpportunitySection  | `OpportunitySection.tsx`  | Score/oportunidade    | 📋     |
| ScoreSection        | `ScoreSection.tsx`        | Composição do score   | 📋     |
| MessagingSection    | `MessagingSection.tsx`    | Mensagens             | 📋     |
| PipelineSection     | `PipelineSection.tsx`     | Pipeline preview      | 📋     |
| MapSection          | `MapSection.tsx`          | Mapa preview          | 📋     |
| ProductPreview      | `ProductPreview.tsx`      | Preview do produto    | 📋     |
| UseCasesSection     | `UseCasesSection.tsx`     | Casos de uso          | 📋     |
| AgencySection       | `AgencySection.tsx`       | Para agências         | 📋     |
| CaseStudySection    | `CaseStudySection.tsx`    | Case study            | 📋     |
| TestimonialsSection | `TestimonialsSection.tsx` | Depoimentos           | 📋     |
| FAQSection          | `FAQSection.tsx`          | FAQ                   | 📋     |
| PlanCard            | `PlanCard.tsx`            | Card de plano         | 📋     |
| PricingPage         | `PricingPage.tsx`         | Página de preços      | 📋     |
| PricingComparison   | `PricingComparison.tsx`   | Tabela comparativa    | 📋     |
| PricingTeaser       | `PricingTeaser.tsx`       | Teasers de preço      | 📋     |
| FounderOffer        | `FounderOffer.tsx`        | Oferta especial       | 📋     |
| FinalCTA            | `FinalCTA.tsx`            | CTA final             | 📋     |
| SalesContactForm    | `SalesContactForm.tsx`    | Form de contato       | 📋     |
| MarketingHeader     | `MarketingHeader.tsx`     | Header público        | 📋     |
| MarketingFooter     | `MarketingFooter.tsx`     | Footer público        | 📋     |
| Section             | `Section.tsx`             | Wrapper de seção      | ✅     |

## Status por categoria

| Categoria           | Total   | ✅     | 📋     | 🔄    | 🔒    |
| ------------------- | ------- | ------ | ------ | ----- | ----- |
| App Shell           | 2       | 2      | 0      | 0     | 0     |
| Navegação principal | 9       | 6      | 2      | 1     | 0     |
| Autenticação        | 4       | 0      | 4      | 0     | 0     |
| Site público        | 2       | 0      | 2      | 0     | 0     |
| Shared              | 5       | 2      | 3      | 0     | 0     |
| UI (shadcn)         | 19      | 12     | 7      | 0     | 0     |
| App components      | 26      | 2      | 23     | 1     | 0     |
| Message template    | 10      | 5      | 5      | 0     | 0     |
| Marketing           | 27      | 1      | 26     | 0     | 0     |
| **TOTAL**           | **104** | **42** | **62** | **0** | **0** |

## Ordem de prioridade para migração

1. **Autenticação** (4 páginas) — usuário vê antes de tudo, baixo esforço
2. **Hoje + Agenda** (2 páginas) — alta frequência de uso
3. **App components restantes** (23) — componentes que sustentam as páginas
4. **Shared components** (3) — DataTable, EmptyState, ErrorState
5. **Marketing** (27) — landing page, preços, conversão
6. **UI shadcn** (7) — baixa prioridade, código gerado

## Critérios de aceitação por arquivo

- [ ] Sem cores hardcoded
- [ ] Ícones via `AppIcon` + `icon-registry` (ou LucideIcon props quando necessário)
- [ ] Tamanhos de ícone na escala canônica (12/14/16/18/20/24)
- [ ] Stroke padronizado (1.5/1.75/2)
- [ ] Texto alinhado à baseline do ícone
- [ ] Áreas clicáveis ≥ 32px para ícones interativos
- [ ] aria-label em botões de ícone
- [ ] Tokens semânticos para cores
- [ ] Espaçamento consistente (gap 6-8px ícone+texto)
- [ ] Estados completos: default, hover, active, selected, focus, disabled, loading, empty, error
