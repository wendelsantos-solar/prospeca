# Sistema de Ícones V2 — Mapa de Migração

Status da migração dos arquivos que importam `lucide-react` para o novo
sistema (`AppIcon` + `icon-registry`).

## ✅ Migração completa

| Arquivo                      | Ícones                                                            |
| ---------------------------- | ----------------------------------------------------------------- |
| `NavRail.tsx`                | 10 ícones — tamanhos padronizados: nav 18px, util 16px, logo 20px |
| `TopNav.tsx`                 | 6 ícones — tamanhos padronizados: 12/14/18px                      |
| `Badges.tsx`                 | 3 ícones — TemperatureBadge + ScorePill                           |
| `PersonalizationSummary.tsx` | 2 ícones — CheckCircle2→success, Circle→warning                   |
| `LeadDetailsDrawer.tsx`      | Loader2→LoaderCircle (1 ícone)                                    |

## ✅ Correções de cores/tamanhos (todos os arquivos)

| Problema                                   | Status                                  |
| ------------------------------------------ | --------------------------------------- |
| Cores `emerald-*` hardcoded                | ✅ Eliminado (2 arquivos)               |
| Cores `amber-*` hardcoded                  | ✅ Eliminado (2 arquivos)               |
| Unicode `✓` como ícone                     | ✅ Substituído por SVG Check            |
| Tamanhos fora da escala (13/15/19/21/22px) | ✅ Corrigidos (NavRail, TopNav)         |
| `strokeWidth` fora da escala (2.2, 2.5)    | ✅ Corrigido (NavRail, badges de score) |

## 🔄 Migração pendente (mecânica, sem risco)

63 arquivos ainda usam imports diretos de `lucide-react`. A fundação está
pronta (`icon-registry.ts` com 95+ ícones, `AppIcon`, `IconButton`).

**Estratégia:** migrar cada arquivo quando for tocado por outra feature.
Não há urgência — os tamanhos e cores já estão padronizados; a migração
dos imports é puramente organizacional.

### Como migrar um arquivo (receita)

1. Adicionar `import { AppIcon } from "@/design-system/icons/AppIcon"`
2. Adicionar `import { icons } from "@/design-system/icons/icon-registry"`
3. Para ícones inline: `<Icon className="h-X w-X" />` → `<AppIcon icon={icons.dominio.nome} size="..." tone="..." decorative />`
4. Para ícones passados como prop (`LucideIcon`): manter import Lucide
5. Mapear tamanho: `h-3`→`xs`, `h-3.5`→`sm`, `h-4`→`md`, `h-5`→`xl`, `h-6`→`display`
6. Verificar build: `npx tsc --noEmit`

### Arquivos por domínio

**App components (alta prioridade):**

- `AppSidebar.tsx` — ícones usados como props (LucideIcon), manter imports
- `DiscoveryCard.tsx` — 8 ícones inline
- `KanbanBoard.tsx` — complexo, ícones como props + inline
- `CommandPalette.tsx` — ícones em NAV_ITEMS tipado (LucideIcon)
- `ResultsList.tsx` — 8 ícones inline
- `SearchForm.tsx` — 5 ícones inline
- `LeadDetailsDrawer.tsx` — 27 ícones restantes
- `Dashboard.tsx`, `Filters.tsx`, `BulkBar.tsx`, `StageDialogs.tsx`
- `PrepareMessageDialog.tsx`, `SavedFiltersBar.tsx`
- `NbaCard.tsx`, `ActivityItem.tsx`
- `NotificationsPopover.tsx`, `RadarPill.tsx`
- `HistoryDrawer.tsx`, `LocationPrompt.tsx`
- `LeafletMapView.tsx`, `GoogleMapView.tsx`
- `UsageCostCard.tsx`

**Message template (baixa prioridade):**

- `MessageTemplateModal.tsx`, `MessageTemplateHeader.tsx`
- `TemplateFooter.tsx`, `VariableSection.tsx`
- `PreviewPanel.tsx`, `FormattingToolbar.tsx`
- `MessageEditor.tsx`

**Shared components:**

- `DataTable.tsx` — 3 ícones
- `ErrorState.tsx` — 3 ícones

**UI components (shadcn/ui):**

- Manter como estão — seguem convenções shadcn

**Marketing (landing page):**

- `HeroSection.tsx`, `TrustStrip.tsx`, `PlanCard.tsx`
- `AgencySection.tsx`, `ProblemSection.tsx`, `ProductPreview.tsx`
- `UseCasesSection.tsx`, `PricingComparison.tsx`, `SalesContactForm.tsx`
- `MarketingHeader.tsx`, `MarketingFooter.tsx`, `FinalCTA.tsx`
- `PricingTeaser.tsx`, `OpportunitySection.tsx`, `MessagingSection.tsx`

### Exceções permanentes

| Arquivo                   | Motivo                               |
| ------------------------- | ------------------------------------ |
| `ConversationPreview.tsx` | Cores de marca WhatsApp — spec §1    |
| `ui/*.tsx` (shadcn)       | Código gerado, convenções shadcn     |
| `map-popup.ts`            | HTML inline para Leaflet/Google Maps |
