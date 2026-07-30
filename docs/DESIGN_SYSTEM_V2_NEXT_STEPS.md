# Design System V2 — próximas etapas

Roteiro do que falta, derivado de `docs/DESIGN_SYSTEM_V2_AUDIT.md`
(achados completos + justificativas lá). Este arquivo é só a lista de
ação. Atualizar conforme cada item for feito.

## Pendente — reportado pelo usuário, ainda sem detalhe

- [ ] **Ícones do menu lateral (`NavRail.tsx`)** — usuário sinalizou que
  "precisa de ajuste", sem especificar o quê. Precisa de detalhe antes
  de mexer: tamanho? peso do traço (stroke)? inconsistência entre os
  ícones de navegação vs os de tema/configurações? Algum ícone errado
  pro destino?

## Pendente — já mapeado no audit

1. **Drawer do lead** (`LeadDetailsDrawer.tsx`)
   - Largura hoje 672px (`w-full sm:max-w-2xl`) — spec pede 540-600px.
   - Bloco "Oportunidade" (score/resumo/pontos fortes) é sempre visível
     acima das abas — devia virar uma 5ª aba própria (`Visão geral /
     Oportunidade / Notas / Atividades / Timeline`).

2. **Editor de mensagem** (`MessageTemplateModal.tsx`/`MessageEditor.tsx`)
   - Split editor/preview é 52/48 — spec pede 58/42.
   - Chips de variável usam `emerald-*` hardcoded — trocar pros tokens
     `--primary`/`--primary-soft` do resto do app.

3. **`LeadCard.tsx`** — código morto (zero import em todo o repo,
   confirmado via grep). Candidato a remoção — decisão do usuário antes
   de apagar (pode ter uso planejado que eu não vi).

4. **Avatar de responsável no Pipeline** — bloqueado, não é só design:
   `Lead` não tem campo de responsável/assignee. Requer feature de
   atribuição multi-usuário (plano Agência) antes de fazer sentido.

5. **Cor de seleção** — mantida azul (`--sel`) por decisão explícita do
   usuário, contra o pedido original do spec (verde). Não é pendência,
   é registro da decisão — só reabrir se mudar de ideia.

## Fora do escopo do Design System (mencionado no spec original, não
faz parte desta série de fatias)

- `docs/COST_CONTROL.md` documenta a regra de score antiga (v1) — o
  código real é v3.0.0. Doc desatualizado, achado durante a fatia de
  Configurações, não corrigido (fora do escopo de design).
- Testes E2E, screenshots before/after, WCAG 2.2 AA formal — nenhuma
  fatia até agora incluiu isso; se quiser, vira uma fatia própria.

## Ordem sugerida

Sem prioridade forte entre os itens 1-3 (drawer, editor, LeadCard) — são
independentes, cabe escolher pelo que incomoda mais no uso real. Ícones
da sidebar entram assim que tiver o detalhe do que ajustar.
