# Radar — Refino UX Mapa+Resultados (design)

**Data:** 2026-07-22
**Rota alvo:** `/app/mapa` (Radar Local) — sidebar (`AppSidebar.tsx`, `LeadCard.tsx`, `SearchForm.tsx`) + `MapView.tsx`
**Status:** proposta para revisão

## 1. Problema

Depois de corrigir os bugs de dados da busca (raio/zoom, contagem, retry com estado obsoleto — ver sessão anterior), o usuário testou a tela em uso real e reportou usabilidade ruim:

- Mapa e lista de leads não se sincronizam: clicar num marcador não leva até o card correspondente na lista, e o estado "selecionado" de um card é sutil demais para notar depois de rolar a lista.
- O painel lateral empilha resumo, mini-stats, ordenação, chips de filtro (a maioria zerados) e exportação com o mesmo peso visual — nada indica o que é mais importante de bater o olho primeiro.
- Polimento visual geral (contraste de badges, respiro entre seções) fica abaixo do "nível profissional" que o produto merece.

Esta spec já era antecipada como trabalho futuro na spec anterior (`2026-07-21-radar-config-reactivity-design.md`, item "sincronização mapa↔lista↔kanban bidirecional (polish futuro, spec própria)").

**Princípio-guia:** refino incremental — resolve as dores reais sem reestruturar o layout existente (sidebar + mapa) nem introduzir novos tokens de design.

## 2. Escopo

Três frentes, sem dependência forte entre si (podem ser implementadas e revisadas em qualquer ordem):

1. **Sincronia lista ↔ mapa** — navegação bidirecional visível e óbvia.
2. **Hierarquia do painel lateral** — reduzir ruído visual, destacar o que importa.
3. **Polish visual leve** — contraste e espaçamento usando os tokens `oklch` já existentes em `styles.css`.

**Fora de escopo:** reestruturação de layout (sidebar colapsável avançada, mapa full-bleed, bottom-sheet), onboarding/estado vazio pré-primeira-busca, outras telas (Kanban, Painel, Histórico, Configurações, Login/Cadastro) — cada uma teria sua própria spec se necessário.

## 3. Arquitetura

### 3.1 Sincronia lista → mapa (já existe parcialmente)

Hoje: `LeadCard` `onClick` → `setFocused(lead.id)` (store `useLeadsStore.focusedId`) → `MapView.tsx:292-299` reage a `focusedId` com `map.panTo(...)`. Isso já funciona.

Gap: o marker focado não recebe nenhum destaque temporário (popup/bounce) além do ícone diferente (`markerIcon(l, l.id === focusedId)`), então em mapas com muitos marcadores próximos o usuário pode não notar qual moveu.

Mudança: no mesmo `useEffect` que reage a `focusedId` (`MapView.tsx:292-299`), abrir o popup/tooltip do marker focado (`marker.openPopup()` ou `bindTooltip(...).openTooltip()`) e fechá-lo automaticamente depois de ~2.5s ou na próxima mudança de foco.

### 3.2 Sincronia mapa → lista (gap real)

Hoje: clicar num marker chama `setFocused(l.id)` (`MapView.tsx:233-236`), mas a lista (renderizada com `react-virtuoso` em `AppSidebar.tsx`) não reage — se o card focado estiver fora da viewport da lista virtualizada, o usuário não vê nenhuma mudança.

Mudança:
- `AppSidebar` cria `const virtuosoRef = useRef<VirtuosoHandle>(null)` e passa `ref={virtuosoRef}` ao `Virtuoso`.
- Novo `useEffect(() => { ... }, [focusedId])`: acha o índice do lead focado em `filtered` (array já usado para renderizar a lista) e chama `virtuosoRef.current?.scrollToIndex({ index, align: "center", behavior: "smooth" })`. Guard: só roda quando o foco *não* veio de um clique direto no próprio card (evita scroll desnecessário quando o usuário já está olhando o card) — usar um ref booleano `focusOriginRef` setado em `LeadCard.onClick` antes de `setFocused`, checado e resetado no efeito.

### 3.3 Estado "selecionado" mais persistente

`LeadCard.tsx:95` hoje: `isFocused && "border-info ring-1 ring-info/40"`. Mudança: adicionar `bg-info/5` ao mesmo condicional, mantendo a borda/ring — mais visível ao rolar rápido, sem introduzir cor nova.

### 3.4 Hierarquia do painel lateral

`AppSidebar.tsx:232-247` (bloco de resumo) e a região de filtros/chips logo abaixo (linhas ~ com `QuickFilters`, chips de contagem) recebem os seguintes ajustes, mantendo os componentes existentes:

- **Resumo**: colapsar as duas linhas de texto (`X sem site, de Y encontradas` / `Z de Y enriquecidos`) numa única linha de destaque com a contagem "sem site" em cor quente (já existe `text-hot`), e mover WhatsApp/Telefones/E-mails para badges inline compactos ao lado — não mais um grid de `MiniStat` em bloco separado abaixo.
- **Chips de filtro zerados**: os componentes `QuickFilters`/chip list já calculam contagem por chip; adicionar filtro `count > 0` antes de renderizar, com um toggle "mostrar todos" (texto pequeno, estado local) para o caso raro de precisar ver os zerados.
- Isso não muda nenhuma lógica de filtragem — só o que é renderizado como chip.

### 3.5 Polish visual (tokens existentes, sem novos)

- Badge de `stage` (`bg-muted`) e badge de `estimatedValue` (`bg-accent`) em `LeadCard.tsx:178-185` ficam visualmente parecidos demais (contraste baixo). Ajuste: `estimatedValue` passa a usar `bg-success/15 text-success` (dinheiro = positivo, já existe o token `success` no design system) em vez de `accent`, criando diferenciação clara sem inventar cor nova.
- Espaçamento: padronizar `gap`/`padding` entre o form de busca, o resumo e a lista para um ritmo vertical único (checar `space-y`/`gap` usados hoje em `AppSidebar.tsx` e alinhar para o mesmo valor, provavelmente `gap-3`/`p-3` já dominante — só remover inconsistências pontuais encontradas na implementação).

## 4. Testes

- Manual no browser (preview): buscar → clicar marker → confirmar scroll da lista até o card certo e popup temporário no marker; clicar card → confirmar mapa centraliza e popup abre.
- Manual: lista com poucos leads sem WhatsApp/telefone/e-mail → confirmar chips zerados somem e "mostrar todos" os revela.
- Visual: comparar antes/depois do badge de valor estimado (contraste) e do bloco de resumo.
- Sem testes automatizados novos previstos — mudanças são de apresentação/interação, não lógica de negócio testável isoladamente; typecheck (`tsc --noEmit`) cobre regressões de tipo.

## 5. Riscos / notas

- `scrollToIndex` do `react-virtuoso` pode brigar com o scroll do usuário se ele estiver rolando manualmente no momento do foco vindo do mapa — aceitável, é o comportamento esperado (navegação intencional deve vencer).
- Esconder chips zerados pode confundir quem espera ver todos os filtros sempre — mitigado pelo toggle "mostrar todos".
