# Design: Google-only + Cache Máximo

**Data:** 2026-07-23
**Branch:** `feat/google-only-cache`
**Status:** Rascunho para revisão ponto a ponto (ainda NÃO implementar)

---

## 1. Objetivo

Remover completamente o provedor OSM (Overpass + Nominatim) do projeto e usar **exclusivamente o Google** para descoberta de negócios e geocoding, com a **estratégia de cache mais agressiva possível dentro da ToS do Google**, para manter o custo operacional baixo mesmo com uso pesado.

**Motivação:** OSM tem lacuna de cobertura de negócios (ex: barbearias na Barra da Tijuca não existem no OSM, mas existem no Google). Entregar dado completo > dado barato incompleto.

### Decisões travadas (definidas no brainstorming)

| # | Decisão | Escolha |
|---|---|---|
| D1 | Profundidade da remoção OSM | **Delete total** — places + geocoder Nominatim |
| D2 | Profundidade do cache | **Nível 1 + Nível 2** (wire no Google + precisão grossa + TTL 30d + cross-tenant + cache por cobertura espacial). Tiles/H3 = futuro, fora de escopo |
| D3 | Frescor do dado | **TTL 30d** (limite da ToS) + **botão "atualizar"** (force refresh manual, paga Google) |
| D4 | Score (era R1) | **Bump v2→v3 + re-tunar** para explorar rating/reviews do Google como sinal de oportunidade. Sub-tarefa própria; fórmula nova revisada antes de valer |
| D5 | Dado legado overpass (era R2) | **Compat de leitura, sem migração.** Manter chaves OSM em `CATEGORY_LABELS`; parar só de escrever overpass |
| D6 | Retenção (era R3) | **Por classe:** discovery = efêmero sob TTL 30d; leads no funil = refresh dos campos Google ≤30d. ⚠️ Confirmar ToS atual + jurídico antes do go-live |
| D7 | Force-refresh (era R4) | **Sem limite duro agora**, mas com **cooldown por busca** + **log de uso por org**. Limite por plano depois |
| D8 | Precisão do bucket (era R5) | **Manter precisão 3 (110m)** na chave exata (fast-path). Reuso pesado fica no Nível 2 (cobertura, geometricamente correto). NÃO baixar para 2 |

---

## 2. Pré-requisitos / Bloqueadores

- [ ] `GOOGLE_MAPS_SERVER_KEY` configurado e **billing habilitado** no Google Cloud (sem OSM não há fallback — se a key falhar, a busca para).
- [ ] Restrições da API key aplicadas (por API + IP do edge). Segurança: key nunca vai pro browser (já é server-only em `google.ts`).
- [ ] Alerta de budget no Google Cloud (teto de gasto) — proteção contra abuso/loop.

---

## 3. Escopo — Parte A: Remoção do OSM (delete total)

### 3.1 Arquivos a DELETAR
- `packages/providers/src/overpass.ts` + `overpass.test.ts`
- `packages/providers/src/nominatim.ts` + `nominatim.test.ts`
- `supabase/functions/_shared/osm.ts`
- `supabase/functions/osm.env`

### 3.2 Arquivos a EDITAR
- `packages/providers/src/index.ts` — remover `export * from "./overpass"` e `"./nominatim"`.
- `supabase/functions/execute-search/index.ts` — remover o branch `if (useOsm)` inteiro (linhas ~89-187); manter só o caminho Google, agora **com cache** (ver Parte B).
- `supabase/functions/create-search/index.ts` — remover branch `USE_OSM_GEOCODER` (geocode sempre Google) e branch `USE_OSM_PLACES` do `max_results` (usar só o cap Google, default 60).
- `supabase/functions/geocode-location/index.ts` — remover branch OSM; sempre Google geocoding.
- `supabase/functions/refresh-place-details/index.ts` — remover branch OSM; sempre `placeDetails` Google.
- `.env.example` — remover `USE_OSM_PLACES`, `USE_OSM_GEOCODER`, `OVERPASS_*`, `GEOCODER_*`; manter Google.
- `apps/web/src/lib/env.ts` — remover flag `useOsm` / `VITE_USE_OSM`.
- `apps/web/src/lib/filters.ts` — `QUICK_FILTERS` sempre com o filtro de rating (Google tem rating). Remover o gate `env.useOsm`.
- `apps/web/src/components/app/LeadDetailsDrawer.tsx` — remover condicional `!env.useOsm` (comportamento Google sempre).
- `apps/web/src/components/app/SearchForm.tsx` — atualizar comentário/lógica que assumia "OSM sem custo por request".
- `packages/providers/src/ssrf.test.ts` — remover asserts de `overpass-api.de` / `nominatim.openstreetmap.org`; SSRF guard continua válido para hosts Google.
- `packages/domain/src/dedup.test.ts` — trocar `source: "overpass"` por `"google"` nos fixtures.
- `packages/domain/src/misc.test.ts` — atualizar string de versão de cache (ver §5.1).

### 3.3 Pontos de atenção (⚠️ decisões dentro do delete)

- **A1 — Rótulos de categoria (`apps/web/src/lib/category.ts`):** hoje o `CATEGORY_LABELS` é chaveado por **valor de tag OSM** (`hairdresser`, `clinic`...). O Google grava `primary_type` com **outros valores** (`barber_shop`, `hair_care`, `doctor`, `dental_clinic`...). Sem ajuste, cai no `humanize()` → mostra "Barber Shop" em vez de "Barbearia". **Ação:** ESTENDER `CATEGORY_LABELS` com as chaves de `primaryType` do Google (PT-BR), **mantendo** as chaves OSM antigas (D5 — compat de leitura de linhas legadas).
- **A2 — Score → bump v3 + re-tune (D4):** Google **sempre** traz `rating`/`userRatingCount`. Em vez de só migrar, **explorar** esses sinais: nota baixa / poucas reviews / sem site = lead de alta oportunidade. **Ação:** bumpar `score.ts` v2→v3 e re-tunar pesos para usar rating + review_count + business_status + presença de site. **Sub-tarefa própria** — fórmula nova revisada por você antes de valer (score determinístico versionado muda a ordem dos leads).
- **A3 — Dados legados `source="overpass"` (D5):** **compat de leitura, sem migração.** Não deletar chaves OSM de `CATEGORY_LABELS`; não migrar linhas antigas; só parar de escrever overpass.

---

## 4. Escopo — Parte B: Cache Nível 1 (wire no Google + básico)

**Problema atual:** o cache (`provider_search_cache`) só é lido/escrito no branch OSM. O branch Google **não toca cache** → hoje toda busca Google pagaria.

### 4.1 Mudanças
- **Plugar cache no caminho Google** em `execute-search`: espelhar a lógica do branch OSM — ler `provider_search_cache` por chave (se fresco, servir e incrementar `hit_count`); em miss, chamar `textSearch` paginado, coletar, e `upsert` no cache.
- **Precisão do bucket: MANTER 3 (~110m)** (`placesCacheKey`) — decisão D8. A chave exata fina evita reuso falso (bucket grosso reusaria resultado centrado longe do pedido). O reuso agressivo entre centros/raios fica a cargo do **Nível 2 (cobertura)**, que é geometricamente correto. NÃO baixar para 2.
- **TTL 7d → 30d**: migration alterando o default de `provider_search_cache.expires_at` para `now() + interval '30 days'` (limite da ToS Google).
- **Cross-tenant:** o read já ignora `organization_id` (global). **Manter.** Payload contém só dado público de negócio (sem PII do tenant) → seguro compartilhar. `organization_id` gravado = primeiro fetcher (informativo).

### 4.2 Chave de cache
Formato atual: `v{N}:places:{provider}:{category}:{lat}:{lng}:{radius}`. Provider agora sempre `google_places`.

---

## 5. Escopo — Parte C: Cache Nível 2 (cobertura espacial)

**Ideia:** parar de depender de match de chave exato. Uma busca de raio 10km já **contém** uma busca menor de 5km próxima → deve reusar o payload.

### 5.1 Mudanças de schema (`provider_search_cache`)
Adicionar colunas consultáveis + índice espacial:
- `category text`
- `center geography(Point, 4326)`
- `radius_meters integer`
- Índice GiST em `center`.
- Bump `CACHE_VERSION` v3 → **v4** (schema + semântica de lookup mudaram → invalida payloads antigos).

### 5.2 Lógica de lookup (em `execute-search`, antes de chamar Google)
1. **Fast path (exato):** tenta match por `cache_key` fresco (barato).
2. **Coverage path:** se miss, query espacial —
   ```
   SELECT payload, center, radius_meters
   FROM provider_search_cache
   WHERE category = :cat
     AND expires_at > now()
     AND ST_Distance(center, :reqCenter) + :reqRadius <= radius_meters
   ORDER BY radius_meters ASC   -- menor payload suficiente
   LIMIT 1
   ```
   Se achar, **filtrar o payload por haversine** ao círculo pedido (reusar `bboxFromCircle` + distância) e servir. Conta como hit (custo Google zero).
3. **Miss real:** chama Google, coleta, `upsert` com `cache_key` + `category` + `center` + `radius_meters`.

### 5.3 Nota (D8)
O Nível 2 é o **mecanismo primário de reuso** entre centros/raios diferentes — por isso a chave exata fica em precisão 3 (§4.1). Fast-path exato (barato) → fallback cobertura (geometricamente correto) → miss real (Google).

---

## 6. Escopo — Parte D: Botão "Atualizar" (force refresh)

- **Contrato:** `create-search` `InputSchema` ganha `forceRefresh?: boolean` (default false). Propagado para `execute-search`.
- **Comportamento:** `forceRefresh=true` → **pula leitura de cache** (exato e cobertura), chama Google, e **sobrescreve** o cache (upsert renovando `expires_at`).
- **UI:** botão "Atualizar" no Mapa/Lista que re-dispara a busca atual com `forceRefresh`.
- **Guarda-corpos (D7):** SEM limite duro por plano agora, mas COM: (a) **cooldown** — bloquear refresh da mesma busca (mesma chave) dentro de uma janela curta (ex: 10 min) para evitar loop acidental de custo; (b) **log de uso de refresh por org** (`usage`/`recordUsage`) para enxergar abuso antes de doer. Limite por plano entra depois, com base nos dados de uso.

---

## 7. Conformidade (ToS Google + LGPD)

- **ToS Google Places:** `place_id` pode ser guardado por tempo indefinido; **demais campos** (nome, telefone, rating, endereço) têm cache limitado a **≤30 dias** — depois exige refetch. O TTL de 30d no `provider_search_cache` respeita isso.
- **Retenção por classe de dado (D6) — resolvido:**
  - **Discovery (`search_results ⋈ places`):** efêmero. Vive sob o TTL de 30d do cache; não persiste conteúdo Google além disso — re-busca do cache/Google. Linhas `places` puramente de discovery, sem lead vinculado, podem ser expiradas/limpas após 30d mantendo só `provider_place_id` (permitido indefinidamente pela ToS).
  - **Leads no funil (materializados via +Funil/WhatsApp na tabela `leads`):** poucos e ativos. Refresh dos campos vindos do Google (rating, horário, status) em cadência ≤30d via `refresh-place-details` (barato — poucas linhas). Nome/telefone que o cliente já trabalha = registro de CRM dele.
  - **⚠️ Confirmar na ToS ATUAL do Google Maps Platform + idealmente jurídico antes do go-live comercial.** É a única parte que não se fecha só no técnico.
- **LGPD:** dado de negócio (razão social, telefone comercial público) tem baixo risco de PII. Cache cross-tenant não expõe dado de um tenant a outro (só dado público de negócio). Manter as políticas de retenção de PII já existentes (não regride).

---

## 8. Plano de implementação (fases — cada uma testável isolada)

1. **Fase 1 — Remoção OSM (Parte A):** deletar/editar arquivos, ajustar testes, build + testes verdes com Google como único caminho. Inclui A1 (estender rótulos, manter chaves OSM) e A3 (compat de leitura).
2. **Fase 2 — Cache Nível 1 (Parte B):** plugar cache no Google + TTL 30d (migration). Precisão fica em 3 (D8).
3. **Fase 3 — Cache Nível 2 (Parte C):** migration de schema (colunas + GiST), lógica de cobertura + filtro haversine.
4. **Fase 4 — Force refresh (Parte D):** contrato + edge + botão UI + cooldown + log de uso (D7).
5. **Fase 5 — Conformidade (§7 / D6):** retenção por classe (discovery efêmero; funil refresh ≤30d).
6. **Fase 6 — Score v3 (A2 / D4):** bump + re-tune usando rating/reviews. **Fórmula revisada por você antes de mergear.** Independente das demais — pode vir por último.

Sugestão: fases 1-2 já entregam ~80% do valor; 3-6 incrementais. Fase 6 (score) é a mais sensível a produto — isolada de propósito.

---

## 9. Testes

- **Unit:** `placesCacheKey` com precisão 2; math de contenção do Nível 2 (`ST_Distance + reqRadius <= radius`); filtro haversine do payload; bypass de cache com `forceRefresh`.
- **Edge/integração:** `execute-search` Google com (a) cache hit exato, (b) cache hit por cobertura, (c) miss real, (d) forceRefresh.
- **Regressão:** remover testes OSM; atualizar fixtures `source: "google"`; atualizar string de versão de cache v4.
- Runner: `bun test`.

---

## 10. Decisões (antes abertas) + risco remanescente

Todas resolvidas no brainstorming (ver D4-D8 na §1):

| # | Item | Decisão |
|---|---|---|
| R1→D4 | Score OSM-aware | Bump v3 + re-tune usando rating/reviews. Fase 6, isolada, fórmula revisada antes |
| R2→D5 | Dado legado overpass | Compat de leitura, sem migração |
| R3→D6 | Retenção `places` ≤30d | Por classe: discovery efêmero / funil refresh ≤30d |
| R4→D7 | Limite force-refresh | Sem limite duro; cooldown + log agora |
| R5→D8 | Precisão do bucket | Manter 3; reuso via Nível 2 (cobertura) |

**Risco remanescente (único que não fecha no técnico):** conformidade ToS Google sobre retenção (D6/§7). **Ação antes do go-live comercial:** validar prazos na ToS atual + revisão jurídica. Confirmar também se há dado prod com `source=overpass` a preservar (afeta só validação, não o design — D5 já é retrocompatível).

---

## 11. Apêndice — Modelo de custo (referência)

- SKU: **Text Search Enterprise** (field mask tem rating/phone/website) = **US$35/1.000 req**. Grátis: 1.000 req/mês.
- Billing por request (página), `pageSize=20`, cap 60 = até 3 páginas = **$0,105/busca** (cache miss). Cache hit = **$0**.
- **Custo mensal ≈ áreas únicas (nicho × célula × raio) por janela de TTL × 3 páginas × $0,035** — desacoplado do nº de buscas.
- 100 clientes, ~60k buscas/mês, cache máximo: faixa **~R$850–2.270/mês** (R$8,50–22,70/cliente). Sem cache: ~R$20k/mês (~9×).

_Câmbio de referência ~R$5,4 — validar no dia._
