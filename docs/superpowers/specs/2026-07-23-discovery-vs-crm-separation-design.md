# Radar Local — Separação Descoberta × CRM (design)

**Data:** 2026-07-23
**Áreas:** `execute-search`, `import-search-results`, novo read-path de descoberta, `/app/mapa`, `/app/kanban`, `/app/painel`, migração de dados
**Status:** proposta para revisão

## 1. Problema

Hoje **toda busca auto-importa TODAS as empresas encontradas** para a tabela `leads` com `stage='new'`. O disparo acontece em dois lugares (ambos deduplicados entre si):

- `execute-search/index.ts:306` — atrás da flag `AUTO_IMPORT_LEADS` (default `true`), chama `import-search-results` com `importAll=true`.
- `useSearchMutation.ts:132` — o front chama `importResults(searchId, [], true)` depois do polling.

Consequências:
- **Kanban "Novo" vira lixão**: centenas de empresas nunca olhadas empilhadas como leads.
- **Painel infla**: métricas de funil contam descobertas que ninguém trabalhou.
- **Tabela `leads` incha** ~até 500 linhas por busca; `list()` e a cadeia de dedup (`import-search-results` faz 3 SELECTs por resultado) degradam com o tamanho.

Além disso, score/temperatura/enriquecimento são calculados **só na importação** (`import-search-results/index.ts:143`); a tabela `places` não guarda score. Por isso o mapa só mostra score porque a importação já rodou.

**Princípio-guia:** descoberta e CRM são coisas diferentes. Descoberta é o que a busca acha (efêmero-persistido por busca). CRM/funil é o que o usuário **escolhe** trabalhar. Um lead só existe quando o usuário age sobre a empresa.

## 2. Modelo-alvo

- **Descoberta** = `places` + `search_results`. A busca grava aqui e calcula score/temperatura no momento da busca. Não cria leads. Persistido por `search_id` (reabrível via histórico).
- **Funil/CRM** = `leads`. Uma linha nasce só quando o usuário adiciona a empresa ao funil, explicitamente (+Funil) ou implicitamente (contatar por WhatsApp / disparo em massa).

## 3. Mudanças de dados

### 3.1 Score no `search_results` (migração)
Adicionar colunas a `public.search_results`:
```sql
alter table public.search_results
  add column score integer,
  add column temperature text check (temperature in ('hot','warm','cold')),
  add column score_breakdown jsonb;
```
Score mora aqui (não em `places`) porque **depende da distância**, que é por-busca (`calculateScore` recebe `distanceMeters`). Uma mesma empresa tem score diferente em buscas de centros diferentes.

### 3.2 Limpeza dos leads acumulados (migração)
```sql
delete from public.leads l
where l.source = 'search'
  and l.stage = 'new'
  and l.last_interaction_at is null
  and not exists (select 1 from public.lead_notes n where n.lead_id = l.id)
  and not exists (select 1 from public.lead_activities a where a.lead_id = l.id);
```
Apaga só o lixo de descoberta nunca tocado. Preserva qualquer lead movido de estágio, anotado, com atividade ou interação. `search_results.imported_lead_id` desses vira dangling → zerar junto:
```sql
update public.search_results sr set imported_lead_id = null
where imported_lead_id is not null
  and not exists (select 1 from public.leads l where l.id = sr.imported_lead_id);
```

## 4. Tempo da busca (`execute-search`)

1. Depois do upsert de `places` e antes/junto do upsert de `search_results` (passo 3, linha 277), calcular por resultado, com o **mesmo** `calculateScore` de `_shared/score.ts`, usando os sinais já disponíveis do OSM/place: `hasWebsite`, telefone válido (via `normalizeBrazilianPhone`), `whatsappStatus` (`possible` se móvel), `rating`, `reviewCount`, `distanceMeters`, `businessStatus`. `hasEmail`/`hasInstagram` = false (sem scrape). Gravar `score`, `temperature`, `score_breakdown` nas novas colunas de `search_results`.
2. **Desligar o auto-import**: remover o bloco `AUTO_IMPORT_LEADS` de `execute-search` (linhas 304-322) e a chamada `importResults(searchId, [], true)` do front (`useSearchMutation.ts:132`). A materialização de leads passa a acontecer só via §6.
3. Sem scrape de site na busca (barato, rápido, sem custo de enrichment).

**Paridade de score:** a extração de sinais no search-time deve produzir os mesmos inputs que `import-search-results` produzia, para o score não mudar de valor. Reusar as mesmas helpers (`normalizeBrazilianPhone`, `hasRealWebsite`, `readPoint`) e a mesma `calculateScore`. Coberto por teste de paridade (§8).

## 5. Leitura da descoberta (mapa + lista da sidebar)

### 5.1 Fonte
Nova RPC `get_search_discovery(p_search_id uuid)` (SQL, `security definer`, RLS via membership do search) que faz `search_results ⋈ places` e devolve **todos** os resultados da busca (não pré-filtra por raio — o slider de raio é client-side e ao vivo): id do place, nome, categoria, coords, telefone, site/has_website, rating, review_count, distance_meters, score, temperature, e `imported_lead_id` (null = ainda não está no funil). Ordenação por score/distância no cliente.

### 5.2 Frontend
- Novo tipo `DiscoveryResult` e método `SearchRepository.getDiscovery(searchId)`.
- Novo hook `useDiscoveryResults(searchId)` (TanStack Query, key `["discovery", searchId]`).
- `MapView` e a lista da sidebar passam a consumir `DiscoveryResult[]` em vez de `Lead[]` para a tela de descoberta. O filtro de raio client-side (`filterByRadius`) continua, agora sobre discovery rows. O contador/resumo da sidebar (sem site / enriquecidos / canais) calcula sobre discovery.
- **Marca "já no funil"**: resultados com `imported_lead_id != null` ganham indicador sutil (anel/badge no marcador e no card) e o botão vira "No funil" em vez de "+Funil".

### 5.3 Reconciliação com a mudança desta sessão
O escopo `useLeadsList(..., searchId)` (memória `leads-table-dual-purpose-scoping`) era paliativo — lia `leads` filtrado por `search_results.imported_lead_id`. Com descoberta lendo `search_results` direto, o mapa **deixa de usar** esse caminho. Remover o `searchId` do uso no mapa/sidebar; `useLeadsList` volta a ser só CRM. Kanban/Painel nunca usaram searchId. Atualizar a memória.

## 6. Adicionar ao funil

Ação unificada `addToFunnel(placeId, { stage })` no repositório, que chama `import-search-results` com `placeIds:[placeId]`, `importAll:false`, e um `stage` alvo. Reusa a cadeia de dedup/criação existente (`import-search-results` já cria 1 lead por place com dedup por place/telefone/domínio).

Gatilhos e estágio de destino:
- **+Funil** (card/popup) → `stage='new'` (entra no pipeline como prospect escolhido).
- **WhatsApp** (card/popup) → cria com `stage='contacted'` (você falou com a empresa) e então abre o `wa.me`.
- **Disparo em massa** ("Iniciar prospecção em massa") → cria os selecionados com `stage='contacted'` antes de preparar as mensagens. O `BulkBar` opera sobre discovery ids (place ids); ao disparar, materializa os leads.

Ajuste no `import-search-results`: aceitar um `stage` opcional no input (default `'new'`) aplicado no insert; para duplicados já existentes, não rebaixar estágio (nunca mover para trás).

**Enriquecimento sob demanda:** após criar o lead, disparar `enrich-lead` (scrape de site → email/whatsapp) só para aquele lead. Deep enrich deixa de ser cumulativo; roda quando a empresa entra no funil.

## 7. Kanban / Painel

Sem mudança de código: `useLeadsList` sem searchId passa a retornar naturalmente só leads de funil. "Novo" = prospects escolhidos. Painel = métricas reais de funil. (A limpeza da §3.2 garante que começam limpos.)

## 8. Testes

- **Unit — paridade de score:** dado o mesmo place/distância, o score calculado no search-time == o que `import-search-results` calculava. Teste em `packages/*` ou no shared de score.
- **Unit — predicado da migração:** a query de delete só remove leads intocados (montar fixtures com/sem nota/atividade/interação/estágio).
- **Manual (preview):**
  1. Busca → mapa mostra resultados com score; `select count(*) from leads` **não** aumenta.
  2. +Funil num card → 1 lead aparece no Kanban "Novo"; marcador vira "No funil".
  3. WhatsApp num card → lead em "Contatado" + abre wa.me.
  4. Disparo em massa de N selecionados → N leads em "Contatado".
  5. Refresh → descoberta re-lê de `search_results` (persistente); Kanban só funil.
- **Migração:** rodar em cópia/staging; confirmar que leads tocados sobrevivem e o lixo some.

## 9. Ordem de implementação (sub-fases)

1. **Migração de schema** (colunas de score em search_results) + **migração de limpeza** (leads intocados). Deploy.
2. **Scoring no search-time** em `execute-search` + desligar auto-import. Deploy. (Neste ponto o mapa quebraria se ainda lesse `leads` — por isso 3 vem junto.)
3. **Read-path de descoberta**: RPC + repo + hook + MapView/sidebar consumindo discovery. Remove `importResults(importAll)` do front.
4. **Add-to-funnel**: `import-search-results` aceita `stage`; ações +Funil/WhatsApp/disparo materializam leads; indicador "já no funil".
5. **Enrich sob demanda** ao entrar no funil.

Fases 1-3 são um bloco atômico (mapa depende delas juntas); 4-5 podem vir logo depois.

## 10. Riscos

- **Paridade de score** — se o search-time computar sinais diferentes do import-time, scores mudam de valor. Mitigar reusando exatamente as mesmas helpers + teste de paridade.
- **Fluxo de disparo em massa** hoje assume leads existentes. Precisa virar "materializa-depois-dispara"; revisar `BulkBar`/`MessageTemplateDialog`.
- **Transação/ordem no execute-search** — score deve ser gravado no mesmo upsert de `search_results`; garantir que falha parcial não deixe resultados sem score (fallback: score null → mapa trata como 0/neutro).
- **RLS da nova RPC** — `security definer` com checagem de membership do search, igual às policies existentes.
- **Migração destrutiva** — o delete é irreversível; rodar backup/staging antes.
