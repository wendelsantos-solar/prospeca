# Radar — Reatividade de configuração (design)

**Data:** 2026-07-21
**Rota alvo:** `/app/mapa` (Prospeca)
**Status:** proposta para revisão

## 1. Problema

O Radar mistura duas classes de operação numa única tela, mas trata todas como iguais:

- **Baratas e instantâneas** (client-side, custo zero): desenhar o círculo do raio, filtrar leads já carregados, ordenar, mover o mapa.
- **Caras e lentas** (Google Places via Edge Function `execute-search`: geocode → search → import → enrich, com polling de 800ms): a busca de empresas em si, que gasta quota paga.

Hoje **tudo** fica atrás do botão "Buscar empresas". A config vive só em `useState` local no `SearchForm` (`SearchForm.tsx:84-99`), invisível ao resto do app. Consequências:

- Arrastar o slider de raio **não redesenha o círculo** — o círculo só reage a `currentSearch`/`previewLocation` (`MapView.tsx:136-189`). A tela parece morta.
- Mudar nicho/local/raio **depois** de buscar não dá nenhum sinal de que os resultados na tela estão desatualizados.
- Filtros e slider não mostram quantos leads seriam afetados.

**Princípio-guia:** feedback instantâneo para o que é barato; commit explícito para o que é caro — mas nunca deixar o usuário no escuro sobre qual é qual.

## 2. Escopo

Quatro movimentos, em ordem de prioridade de implementação:

1. **Estado "dirty" + "Buscar nesta área"** — sinalizar resultados desatualizados; nunca auto-disparar busca paga.
2. **Slider de raio com feedback vivo** — círculo redesenha ao arrastar + contador ao vivo; raio pra baixo filtra client-side.
3. **Filtros com contagem viva + estado vazio útil** — cada chip mostra quantos leads casam; instantâneo sobre memória.
4. **Progresso de busca melhorado** — a infra já existe (`SearchProgress`); adicionar skeleton nos cards e (stretch) streaming de markers.

**Fora de escopo:** busca 100% reativa a cada mudança de config (custo Google Places); autocomplete de localização com geocode real (hoje `historyService.suggestLocation` é local/síncrono — debounce só entra se/quando geocode remoto for adicionado); sincronização mapa↔lista↔kanban bidirecional (polish futuro, spec própria).

## 3. Arquitetura

### 3.1 Fonte única de verdade para a config: `useSearchDraftStore`

Hoje a config é `useState` no `SearchForm`, então nem o `MapView` nem uma pill flutuante conseguem observá-la. Introduzir um store zustand dedicado (padrão idêntico aos stores existentes em `stores/index.ts`):

```ts
interface SearchDraft {
  niche: string;
  location: string;
  coords: { lat: number; lng: number };
  radiusKm: number;
  presence: PresenceFilter;
}
interface SearchDraftState {
  draft: SearchDraft;
  setDraft: (patch: Partial<SearchDraft>) => void;
  resetDraftTo: (search: Search) => void; // hidrata draft a partir de uma busca commitada
}
```

- `SearchForm` passa a **consumir e escrever** nesse store em vez de `useState` local (refactor de uma via — sem duplicar estado).
- Persistência: **não persistir** no localStorage. Na montagem, o draft hidrata a partir de `currentSearch` (se existir) ou dos defaults de `useSettingsStore` (`defaultPresence`, `defaultRadius`) + `lastLocation` — mesma lógica de hidratação que o `SearchForm` já faz hoje (`SearchForm.tsx:94-97, 139-145`). A fonte de verdade dos resultados continua sendo `currentSearch` no `useLeadsStore`.
- Ao concluir uma busca (`setLeads`), o draft é sincronizado com o `currentSearch` resultante → estado "dirty" zera.

### 3.2 Detecção de "dirty" — o que exige re-busca vs o que é client-side

Comparação entre `draft` e `currentSearch` classifica cada campo:

| Campo | Muda pra... | Ação |
|---|---|---|
| `niche` | qualquer | **dirty** (server) |
| `location`/`coords` | qualquer | **dirty** (server) |
| `radiusKm` | **menor** que o commitado | client-side (filtra por distância) |
| `radiusKm` | **maior** que o commitado | **dirty** (server — pode haver empresas fora do raio buscado) |
| `presence` | **mais restritivo** (ex: all→sem-site) | client-side (`applyPresenceFilter`) |
| `presence` | **mais amplo** (ex: sem-site→all) | **dirty** (server só trouxe o subconjunto) |
| viewport do mapa | centro afastado do `currentSearch` | **dirty** (opcional — "buscar nesta área") |

Selector derivado `useIsDirty()`: retorna `boolean` + motivo (para o texto da pill).

### 3.3 Componentes

- **`SearchForm`** (`SearchForm.tsx`): consome `useSearchDraftStore`. Botão "Buscar empresas" ganha estado visual *dirty* (cor âmbar + "Atualizar busca") quando `useIsDirty()` é true.
- **`MapView`** (`MapView.tsx`): novo efeito de "círculo de rascunho" — quando `draft` difere de `currentSearch`, desenha o círculo a partir de `draft.coords`/`draft.radiusKm` (reaproveita a mecânica de `previewLocation`, linhas 163-189). Marcadores fora do raio de rascunho (quando raio ↓) ficam esmaecidos/ocultos.
- **`RadarPill`** (novo, overlay no mapa): pill flutuante "Atualizar busca aqui" quando dirty ou mapa panado. Clica → `runSearch()` usando o centro/raio atuais. Reusa `moveend` já existente (`MapView.tsx:123`).
- **`QuickFilters`** (`Filters.tsx:39`): cada chip passa a exibir contagem — `label (N)` — via selector que aplica `applyFilters` com o id do chip sobre os leads atuais. Estado vazio útil quando o filtro ativo zera a lista.

### 3.4 Fluxo de dados

```
draft (useSearchDraftStore)
  ├─ slider/nicho/local/presence  → setDraft()
  ├─ MapView                      → círculo de rascunho + esmaecer markers fora do raio
  ├─ useIsDirty()                 → botão âmbar + RadarPill
  └─ botão "Buscar" / pill        → runSearch(draft) → useSearchMutation
                                        └─ onSuccess → setLeads() → resetDraftTo(currentSearch)  [dirty zera]
```

## 4. Cálculo de distância (raio pra baixo, contagem viva)

`Lead` já tem `latitude`, `longitude` e `distanceKm` (`MapView.tsx:54, 198`). Para "empresas dentro do raio de rascunho":

- Usar `distanceKm` quando o centro do rascunho == centro commitado (raio só mudou) — comparação direta `l.distanceKm <= draft.radiusKm`.
- Se o centro mudou, recalcular via haversine (`draft.coords` → `l.{lat,lng}`). Helper puro `distanceKm(a, b)` em `lib/geo.ts` (novo, testável isolado).

Contador ao vivo abaixo do slider: `~N empresas neste raio`.

## 5. Tratamento de erros / edge cases

- **Sem busca ainda** (`currentSearch == null`): draft não é "dirty" (nada pra comparar); círculo de rascunho aparece a partir do draft/preview; pill não aparece.
- **Busca em andamento** (`searching == true`): botão e pill desabilitados; slider continua desenhando círculo (barato) mas não marca dirty até a busca terminar.
- **Filtro zera resultados**: estado vazio com CTA "afrouxe os filtros".
- **Raio máximo/mínimo**: `RADIUS_OPTIONS = [1,5,10,20,30,50,100]` — comparação por valor, não por índice, para robustez.

## 6. Testes

- `lib/geo.ts` — `distanceKm()`: casos conhecidos (mesmo ponto = 0; pontos com distância verificável). TDD.
- `useIsDirty` (ou o selector puro por trás dele): tabela da seção 3.2 — cada transição de campo retorna dirty correto. Teste unitário do reducer/selector puro, sem React.
- Contagem de filtros: selector que aplica `applyFilters` por chip retorna contagens corretas sobre um fixture de leads.
- Component/integration (se houver harness): arrastar slider redesenha círculo sem disparar mutation; concluir busca zera dirty.

## 7. Plano de implementação (fases)

1. **Fase A** — `lib/geo.ts` + `useSearchDraftStore` + refactor `SearchForm` para consumir o store (sem mudança visível ainda). Base para todo o resto.
2. **Fase B** — Movimento #2: círculo de rascunho vivo + contador de raio + filtro por distância no raio ↓.
3. **Fase C** — Movimento #3: contagem viva nos chips + estado vazio.
4. **Fase D** — Movimento #1: `useIsDirty` + botão âmbar + `RadarPill` + "buscar nesta área".
5. **Fase E** — Movimento #4: skeleton nos cards durante `searching`; (stretch) streaming de markers.

## 8. Quick wins (baixo esforço, ganho imediato)

- Círculo redesenha ao arrastar o slider (Fase B) — maior sensação de "vivo" pelo menor esforço.
- Contagem nos chips (Fase C) — puro selector sobre dados em memória.
