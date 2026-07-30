# Design System V2 — próximas etapas

Roteiro do que falta, derivado de `docs/DESIGN_SYSTEM_V2_AUDIT.md`
(achados completos + justificativas lá). Este arquivo é só a lista de
ação. Atualizar conforme cada item for feito.

## ✅ Sistema de ícones V2 — concluído

- [x] **Fundação**: `icon-registry.ts` (95+ ícones, 11 domínios), `AppIcon`, `IconButton`
- [x] **NavRail** migrado: nav 18px, utilidades 16px, logo 20px
- [x] **TopNav** migrado: tamanhos 12/14/18px padronizados
- [x] **Badges** migrado: TemperatureBadge + ScorePill
- [x] **Cores hardcoded** eliminadas: `emerald-*`, `amber-*` → tokens `--success`, `--warning`, `--ring`
- [x] **Unicode** `✓` → SVG Check inline
- [x] **Tamanhos não-canônicos** (13/15/19/21/22px) → escala padrão (12/14/16/18/20/24)
- [x] **`strokeWidth`** padronizado: 1.5/1.75/2 (removidos 2.2, 2.5 em ícones)
- [x] **63 arquivos** restantes mapeados em `docs/ICON_MIGRATION_MAP.md` — migração mecânica, sem urgência

## ✅ Design System — ajustes concluídos

- [x] **Drawer do lead**: largura 576px + 5ª aba Oportunidade
- [x] **Editor de mensagem**: split 58/42 + token `ring-ring`
- [x] **LeadCard.tsx**: código morto removido

## 🔒 Bloqueado

- [ ] **Avatar no Pipeline** — depende de feature multi-usuário (plano Agência)

## 📝 Decisões documentadas

- Cor de seleção azul (`--sel`) — decisão do usuário

## Fora do escopo

- `docs/COST_CONTROL.md` — regra de score v1 (código real é v3.0.0)
- Testes E2E, screenshots before/after, WCAG 2.2 AA formal

## Como migrar um arquivo ao sistema de ícones

Receita em `docs/ICON_MIGRATION_MAP.md`. Resumo:
1. `import { AppIcon } from "@/design-system/icons/AppIcon"`
2. `import { icons } from "@/design-system/icons/icon-registry"`
3. `<Icon className="h-X w-X" />` → `<AppIcon icon={icons.dominio.nome} size="..." decorative />`
4. Se o ícone não existir no registry, adicioná-lo
5. `npx tsc --noEmit` para verificar
