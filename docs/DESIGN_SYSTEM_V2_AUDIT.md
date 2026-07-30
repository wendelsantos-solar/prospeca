# Design System V2 — auditoria

Feita antes de qualquer mudança desta rodada (3 agentes Explore,
read-only). Objetivo: não redescobrir/reconstruir o que já existe.
Achado central: **um "V2" já está em produção**, construído direto na
`main` (nunca em branch separada — `git log --oneline --all | grep
ds-v2` mostra 12+ commits). O branch `feat/design-system-v2` existe mas
está obsoleto (0 commits à frente da main, já mergeado há tempos).

## Já pronto (não refazer)

- **App shell**: `AppSidebar.tsx:133` já é 360-400px
  (`w-full max-w-[360px] xl:max-w-[400px]`), com header, `SearchForm`,
  resumo, toolbar e lista virtualizada — bate com o pedido de largura.
  Nav (Mapa/Hoje/Pipeline/Agenda/Análises/Administração) vive em
  `NavRail.tsx` (rail de 64px), separado da sidebar.
- **Tokens semânticos**: extensos em `styles.css` — bg/surface/text/
  border/action já existem sob nomes próprios (`--primary`, `--surface`,
  `--border` etc.), luz e escuro. `hot/warm/cold` já têm foreground+soft
  (`styles.css:182-190` luz, `268-276` escuro) — o pedido de tokens de
  temperatura já tava satisfeito, só com nomenclatura diferente da
  sugerida no spec novo.
- **`DiscoveryCard.tsx`**: já tem score-ring (conic-gradient tingido por
  temperatura), `TemperatureBadge` com dot, channel chips, avaliação —
  hierarquia bem próxima do pedido (nome+score, categoria+distância,
  temperatura+canais+avaliação).
- **Popup do mapa** (`map-popup.ts:32-81`): já mostra nome, categoria,
  temperatura, distância, avaliação, presença digital + 3 ações (funil/
  whatsapp/detalhes) — conteúdo já próximo do spec.
- **Kanban**: header de coluna já tem nome+contagem+valor+menu
  (`KanbanBoard.tsx:270-283`, antes desta rodada).
- **`EmptyState`/`ErrorState`/`Skeleton`**: existem, com suporte a
  ícone+título+descrição+ação — só a adoção é baixa (poucos arquivos
  usam).
- **Ícones**: 100% Lucide, nenhuma lib duplicada. Só 2 emoji perdidos
  (`map-popup.ts:9-10`, `📞`/`🌐`) e um `✓` embutido em string HTML
  (`map-popup.ts:47`) — não corrigido nesta rodada (fora do escopo
  combinado, baixo impacto).
- **Densidade**: `useUIStore().density` (`stores/index.ts:48,67,74`) já
  existe, persistida, exposta em `SettingsDialog.tsx:172-186` com labels
  "Compacto"/"Confortável" já em pt-BR — só não estava sendo lida em
  lugar nenhum além do Kanban (corrigido nesta rodada, ver abaixo).
- **Cores hardcoded**: auditoria não achou uma bagunça sistêmica — 34
  hex diretos no repo, concentrados no mock de WhatsApp
  (`ConversationPreview.tsx`, cores intencionalmente iguais à marca
  WhatsApp) e em pins de mapa. Fora desses dois pontos, o app já é bem
  tokenizado.

## Gaps reais (parte corrigida nesta rodada, parte não)

Corrigido nesta rodada:

1. **`stage.*` tokens não existiam** — `KanbanBoard.tsx` emprestava
   `--cold`/`--info`/`--warm`/`--success`/`--destructive` pra colorir
   estágios do Pipeline, sem relação semântica. Criados 5 tokens
   dedicados (`stage-new/qualified/contacted/won/discarded`, luz+escuro)
   e trocado o `stageColor` map pra usá-los.
2. **Empty-state do Kanban** era só ícone + "Arraste leads aqui" — virou
   ícone + título + descrição.
3. **Ações do `KanbanCard`** (WhatsApp, telefone) eram sempre visíveis —
   viraram hover/focus-gated (menu "..." continua sempre acessível).
4. **Densidade não chegava no `DiscoveryCard`** — conectada via
   `AppSidebar.tsx` → `useUIStore().density`.
5. **Sem escala tipográfica nomeada** — criada em `styles.css` (8
   tamanhos, `@theme inline`), mas **não aplicada retroativamente** no
   app inteiro (dezenas de arquivos usam `text-sm`/`text-lg` ad-hoc hoje
   — migração de verdade é trabalho separado, grande).
6. **Radius do modal** não era distinto (12px, igual a card) — bumped
   pra 18px em `dialog.tsx` (só esse componente).

Corrigido na rodada seguinte (mapa):

7. **Mapa** — `markerVisual()` (novo, `map-popup.ts`) unifica a lógica de
   cor/anel/tamanho/z-index, consumida pelos dois renderizadores (antes
   o Leaflet tinha `tempColor`/cores oklch próprias, divergentes dos hex
   do Google). Selecionado agora escala (26px→32px), ganha anel azul
   (`--sel`) e z-index elevado — antes só mudava a cor de preenchimento,
   um bug real (o anel só refletia "no funil", nunca seleção). Os 5
   botões flutuantes viraram 1 cluster consolidado (`GoogleMapView.tsx`/
   `LeafletMapView.tsx`), legenda ganhou toggle colapsar/expandir
   (`useUIStore.mapLegendCollapsed`, persistido). `channelIcons()` (emoji
   morto, nunca chamado) removido.
   - **Não implementado**: estados `won`/`discarded` no marcador — o
     mapa só recebe `DiscoveryResult[]` (workspace de descoberta), que
     não carrega `stage`, só `importedLeadId` genérico. Não existe visão
     de mapa com leads do Pipeline que exporia esses dois estados — sem
     dado real, não fabricado.
   - **Não implementado**: cor dominante no cluster — exigiria agregar
     temperatura de todos os membros do cluster (feature nova, não só
     polish visual), fica pra quando fizer sentido.

Não corrigido — mapeado pra sessões futuras:

8. **Configurações**: página única e plana, só cobre "Integrações" — o
   pedido de central com abas (Geral/Perfil/Prospecção/Score/Mensagens/
   Dados/Plano/Integrações) precisa de reconstrução completa, e boa
   parte do conteúdo ainda não existe no produto (ex: "Plano" depende da
   Fase 3 do billing, que ainda não tem UI).
9. **Análises/Admin**: grid plano de cards idênticos, sem hierarquia
   primário/secundário por tamanho. Tabela de admin por org é `<table>`
   cru, não usa nenhum componente compartilhado.
10. **`DataTable` genérico não existe** — `components/ui/table.tsx` é só
    primitivas shadcn cruas (sem toolbar/busca/filtro/ordenação/seleção/
    paginação/densidade/mobile-card). Usado hoje só de forma ad-hoc em
    Dashboard e Admin.
11. **Drawer do lead**: 672px (`w-full sm:max-w-2xl`), spec pede
    540-600px. Tem 4 abas (Visão geral/Notas/Atividades/Timeline), spec
    pede 5ª aba "Oportunidade" — hoje esse conteúdo (score/resumo/
    pontos fortes) é um bloco sempre visível acima das abas, não uma
    aba própria.
12. **Editor de mensagem**: split 52/48 (spec pede 58/42) — próximo mas
    não exato. Chips de variável usam classes `emerald-*` hardcoded, não
    os tokens `--primary`/`--primary-soft` do resto do app.
13. **Avatar de responsável no Pipeline** (pedido do spec) — **não
    implementado de propósito**: `Lead` não tem campo de
    responsável/assignee, só `WonDeal.owner` (histórico de negócio
    fechado) existe, e a maioria dos planos é `users: 1`
    (`docs/PLANS_AND_ENTITLEMENTS.md`). Adicionar essa UI sem dado real
    seria decorativo — fica registrado como dependência de uma feature
    de atribuição multi-usuário que ainda não existe (plano Agência).
14. **`LeadCard.tsx`**: código morto, zero imports em todo o repo
    (confirmado via grep). Candidato a remoção — não apagado nesta
    rodada sem confirmação explícita.
15. **Cor de seleção**: spec novo pede verde suave; mantida azul
    (`--sel`) por decisão do usuário — é escolha deliberada anterior,
    documentada no próprio código (`styles.css:171`: "distinto do
    primário verde").

## Ordem sugerida pras próximas sessões

1. Mapa (marcadores + consolidar controles) — maior gap visual isolado.
2. `DataTable` genérico — desbloqueia Admin/Análises/Histórico de uma
   vez.
3. Análises/Admin — hierarquia de métricas, depois que o DataTable
   existir pra migrar as tabelas junto.
4. Configurações — maior escopo, mais decisões de produto em aberto
   (o que cada aba realmente contém).
5. Drawer/editor de mensagem — ajustes finos (largura, aba Oportunidade,
   split do editor, tokens dos chips).
