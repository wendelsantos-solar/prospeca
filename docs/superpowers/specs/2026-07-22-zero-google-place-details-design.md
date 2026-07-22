# Design — Zero-Google: OSM Place Details + validação

**Data:** 2026-07-22
**Branch base:** `feat/radar-config-reactivity`
**Objetivo:** rodar a plataforma com **zero chamadas à API do Google**, de forma incremental, aditiva e não-destrutiva (regra-mestra do `docs/migration-plan.md`).

## Contexto

A migração Google→OSM (strangler pattern) já cobre 3 de 4 subsistemas atrás de flags:

| Subsistema | Provider OSM | Flag | Status |
|---|---|---|---|
| Geocoding | `osmGeocode` (Nominatim) | `USE_OSM_GEOCODER` | ✅ pronto |
| Reverse geocode | `osmReverseGeocode` | `USE_OSM_GEOCODER` | ✅ pronto |
| Descoberta de places | `osmSearchBusinesses` (Overpass) | `USE_OSM_PLACES` | ✅ pronto |
| Tiles do mapa | Leaflet + tiles OSM | `VITE_USE_OSM` / `MAP_TILE_URL` | ✅ pronto |
| **Detalhes de place** | **nenhum** | **nenhuma** | ❌ **gap** |

Único bloqueador para zero-Google: `supabase/functions/refresh-place-details/index.ts:32` chama `placeDetails()` (Google) **sem guard de flag**. Com secrets Google vazios, essa função lança `PROVIDER_UNAVAILABLE`.

## Decisões

- **Detalhes via OSM (opção B).** OSM/Overpass fornece nome, telefone, site, endereço, categoria. Campos que só o Google tem — `rating`, `userRatingCount`, `regularOpeningHours` (horário), `businessStatus`, `addressComponents` — ficam **explicitamente vazios** (`not_found`/`null`), nunca inventados. Justificativa: para lead-gen B2B o dado de valor é contato (telefone/site) e o filtro-núcleo do radar (`presence_filter` = com/sem site) é 100% coberto por OSM; rating/horário são cosméticos para este caso de uso.
- **Kill-switch reaproveita mecanismo existente.** `google.ts:serverKey()` já lança erro quando `GOOGLE_MAPS_SERVER_KEY` está ausente. Não criar novo mecanismo. Garantia zero-Google = rotear por flag + operar com key vazia; qualquer chamada Google acidental vira erro barulhento, não silencioso.
- **Não-destrutivo.** Google permanece como adaptador atrás de flag. Nada removido.

## Unidades de trabalho

### 1. `osmPlaceDetails` em `supabase/functions/_shared/osm.ts`

Nova função exportada, retornando o mesmo shape `GooglePlace` que `placeDetails` (para o bloco de update de `refresh-place-details` permanecer inalterado).

```
export async function osmPlaceDetails(providerPlaceId: string): Promise<GooglePlace | null>
```

- Parse do `providerPlaceId` no formato `"<type>/<id>"` (ex. `"node/123"`, `"way/456"`). Se não casar esse formato → retorna `null` (id é do Google, não do OSM — não deve acontecer em modo OSM, mas defensivo).
- Query Overpass por elemento específico:
  ```
  [out:json][timeout:25];
  <type>(<id>);
  out center tags;
  ```
- Reusa `env()`, `fetchJson`, `OVERPASS_BASE_URL`, `OVERPASS_USER_AGENT`, `OVERPASS_TIMEOUT_MS` já existentes no módulo.
- Mapeia tags → `GooglePlace` com a **mesma lógica de tags** de `osmSearchBusinesses` (name, category via `amenity||shop||healthcare||office||leisure||tourism`, address via `addr:*`, `websiteUri` via `website||contact:website`, `nationalPhoneNumber` via `phone||contact:phone`, `location`).
- Campos ausentes no OSM (`rating`, `userRatingCount`, `regularOpeningHours`, `businessStatus`, `addressComponents`) → deixados `undefined` no objeto retornado.
- Sem elemento retornado pelo Overpass → `null`.

**Refino opcional (DRY):** extrair o mapeamento tags→GooglePlace de `osmSearchBusinesses` para um helper `mapElementToPlace(el)` reusado por ambas. Só se não aumentar o risco; senão duplicar o mapeamento pequeno é aceitável.

### 2. Guard de flag em `refresh-place-details/index.ts`

- Linha 32: selecionar provider por flag, espelhando o padrão de `create-search/index.ts:71-74` (import dinâmico mantém OSM descarregado quando flag off):
  ```
  const useOsm = Deno.env.get("USE_OSM_PLACES") === "true";
  const details = useOsm
    ? await (await import("../_shared/osm.ts")).osmPlaceDetails(place.provider_place_id)
    : await placeDetails(place.provider_place_id);
  if (!details) { /* pular este place, não contar como refreshed */ continue; }
  ```
- `recordUsage` (linhas 33-38): `provider: useOsm ? "overpass" : "google_places"`.
- Bloco de update (linhas 39-56): **inalterado** — já usa `?? null` em todos os campos, então rating/horário/status ausentes viram `null` no banco automaticamente.

### 3. Round-trip do `provider_place_id` (verificação, provável zero-código)

- Confirmar que `execute-search` persiste `GooglePlace.id` (que em modo OSM é `"node/123"`) na coluna `places.provider_place_id`. `osmSearchBusinesses` já produz `id: "${el.type}/${el.id}"` (osm.ts:178).
- Se já persiste tal como está, nenhuma mudança. Se transformar o id, ajustar para preservar o formato OSM.

### 4. UI — esconder rating/horário em modo OSM (mínimo)

- Localizar componentes que exibem `rating` / `opening_hours` / `business_status` do lead (card, detalhe).
- Gatear por `VITE_USE_OSM` (mesma flag que já esconde o filtro de nota). Quando OSM: não renderizar esses campos, ou mostrar "—".
- Escopo mínimo: não redesenhar, só ocultar o que fica sempre vazio.

### 5. Flags (ops, fora do git)

Passo de operação, não commitado (secrets):
```
supabase secrets set USE_OSM_GEOCODER=true USE_OSM_PLACES=true USE_OSM_MAP_PROVIDER=true
```
Frontend `.env.local` (já gitignored): `VITE_USE_OSM=true` (já setado), `VITE_GOOGLE_MAPS_BROWSER_KEY=` vazio.

### 6. Docs

- Marcar Fase (place-details) concluída em `docs/migration-plan.md`.
- `docs/local-development.md`: variáveis para rodar OSM-only; marcar `GOOGLE_*` como opcional.
- Nota em `docs/GOOGLE_PLACES_SETUP.md`: Google agora opcional/fallback.

## Testes (TDD — escrever antes da implementação)

Espelhar a suíte unitária de `packages/providers` (mock de `fetch`).

- **`osmPlaceDetails` mapping:** elemento Overpass com tags completas → `GooglePlace` com name/phone/website/address/location corretos.
- **`osmPlaceDetails` campos ausentes:** elemento sem rating/horário → `rating`/`regularOpeningHours` `undefined` (garante `null` no banco, nunca inventado).
- **`osmPlaceDetails` id inválido:** `providerPlaceId` sem `/` → `null`.
- **`osmPlaceDetails` sem resultado:** Overpass retorna `elements: []` → `null`.
- **`buildOverpassElementQuery`** (se extraído): `"node/123"` → query com `node(123);`.
- **Roteamento de provider** em `refresh-place-details`: `USE_OSM_PLACES=true` → chama OSM; off → chama Google. (Teste do seletor de provider isolado, sem rede.)

## Critério de sucesso / validação

1. `bun run build` verde; sem novos erros de lint/typecheck além dos pré-existentes documentados (`setRadius`, prettier).
2. Testes unitários novos passando.
3. Com flags OSM ligadas e `GOOGLE_MAPS_SERVER_KEY` vazio: fluxo completo funciona — buscar no radar, importar leads, refrescar detalhes — **sem** lançar `PROVIDER_UNAVAILABLE`.
4. Grep de sanidade: nenhum caminho de código Google alcançável em modo OSM (chamadas Google só atrás de `USE_OSM_* === false`).

## Fora de escopo (follow-up)

- Rotacionar/remover a key Google reusada (browser == server — risco de segurança Alto; vira irrelevante sem Google, mas rotacionar por higiene).
- Self-host Nominatim/Overpass para volume de produção (rate limit / fair-use das instâncias públicas).
- Fonte alternativa de rating/horário (risco LGPD; brief proíbe inventar dado).
- Guard SSRF nas chamadas OSM (já previsto na Fase 4 do migration-plan; verificar se cobre `osmPlaceDetails`).

## Riscos

| Risco | Mitigação |
|---|---|
| `provider_place_id` não é id OSM em places antigos (criados via Google) | `osmPlaceDetails` retorna `null` para id sem `/`; função pula o place em vez de quebrar. |
| Rate-limit Overpass ao refrescar em lote (até 20 places) | `refresh-place-details` já é limitado a 20/min por org; sequencial. Aceitável no escopo atual. |
| Overpass instável / timeout | `fetchJson` já tem timeout via `OVERPASS_TIMEOUT_MS`; place pulado em erro, não quebra o lote. |
