# Separação Descoberta × CRM — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Descoberta (mapa/lista) mostra resultados da busca sem criar leads; leads só nascem quando o usuário age (+Funil / WhatsApp / disparo em massa).

**Architecture:** Score/temperatura passam a ser calculados no tempo da busca (`execute-search`) e gravados em `search_results`. O mapa/lista leem descoberta via RPC nova (`search_results ⋈ places`), não da tabela `leads`. Materialização de lead vira ação explícita que reusa `import-search-results` com um `stage` alvo. Auto-import é removido.

**Tech Stack:** React + TanStack Query, Zustand, Supabase Edge Functions (Deno/TypeScript), Postgres + RLS, bun test (packages/*).

## Global Constraints

- Score determinístico e versionado: reusar `calculateScore` de `supabase/functions/_shared/score.ts` (`SCORE_RULE_VERSION = "v1.0.0"`). Nunca reimplementar a fórmula.
- Paridade de score: search-time e import-time devem produzir os MESMOS inputs → extrair helper compartilhado, não duplicar.
- Postgres: novas RPCs `security definer` com `set search_path = public` e checagem via `is_organization_member`, seguindo o padrão de `get_quota_status` (`20260719000006_rpcs.sql`).
- Migrations: arquivo em `supabase/migrations/`, nome `YYYYMMDDHHMMSS_<slug>.sql` (a maior existente é `20260720000003`). Deploy remoto via `npx supabase db push --project-ref zxneketqrapvbxyqewar`.
- Edge functions: deploy via `npx supabase functions deploy <name> --project-ref zxneketqrapvbxyqewar --use-api` (Docker indisponível — sempre `--use-api`).
- Env: `USE_OSM_PLACES=true`, `AUTO_IMPORT_LEADS=true` hoje (será desativado).
- Fases 1-3 são um bloco atômico: o mapa quebra se 2 (auto-import off) subir sem 3 (read-path novo). Deploy 1→2→3 em sequência próxima; não deixar 2 em produção sem 3.
- `stage` nunca rebaixa: adicionar ao funil uma empresa que já é lead não move o estágio para trás.

---

## FASE 1 — Migrations (schema + limpeza)

### Task 1: Colunas de score em `search_results`

**Files:**
- Create: `supabase/migrations/20260723000001_search_results_score.sql`

**Interfaces:**
- Produces: colunas `search_results.score int`, `.temperature text`, `.score_breakdown jsonb`.

- [ ] **Step 1: Escrever a migração**

```sql
-- Score por-resultado (depende da distância, que é por-busca).
alter table public.search_results
  add column if not exists score integer,
  add column if not exists temperature text
    check (temperature in ('hot','warm','cold')),
  add column if not exists score_breakdown jsonb;
```

- [ ] **Step 2: Aplicar no projeto remoto**

Run: `npx supabase db push --project-ref zxneketqrapvbxyqewar`
Expected: aplica `20260723000001_search_results_score.sql`, sem erro.

- [ ] **Step 3: Verificar colunas**

Run: `npx supabase db push --project-ref zxneketqrapvbxyqewar --dry-run`
Expected: "Remote database is up to date" (nada pendente).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260723000001_search_results_score.sql
git commit -m "feat(db): add score columns to search_results"
```

### Task 2: Limpeza dos leads de descoberta intocados

**Files:**
- Create: `supabase/migrations/20260723000002_cleanup_untouched_discovery_leads.sql`

**Interfaces:**
- Consumes: tabelas `leads`, `lead_notes`, `lead_activities`, `search_results`.

- [ ] **Step 1: Escrever a migração**

```sql
-- Apaga só o lixo de descoberta: leads de busca, ainda em 'new', nunca tocados.
delete from public.leads l
where l.source = 'search'
  and l.stage = 'new'
  and l.last_interaction_at is null
  and not exists (select 1 from public.lead_notes n where n.lead_id = l.id)
  and not exists (select 1 from public.lead_activities a where a.lead_id = l.id);

-- Zera vínculos de search_results que ficaram apontando para leads apagados.
update public.search_results sr
set imported_lead_id = null
where sr.imported_lead_id is not null
  and not exists (select 1 from public.leads l where l.id = sr.imported_lead_id);
```

- [ ] **Step 2: Aplicar no projeto remoto**

Run: `npx supabase db push --project-ref zxneketqrapvbxyqewar`
Expected: aplica a migração; sem erro.

- [ ] **Step 3: Sanidade — nenhum search_result dangling**

Run (SQL editor ou psql): `select count(*) from search_results sr where sr.imported_lead_id is not null and not exists (select 1 from leads l where l.id = sr.imported_lead_id);`
Expected: `0`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260723000002_cleanup_untouched_discovery_leads.sql
git commit -m "feat(db): purge untouched discovery leads"
```

---

## FASE 2 — Scoring no search-time + desligar auto-import

### Task 3: Helper compartilhado `scoreInputFromPlace` (paridade)

**Files:**
- Create: `supabase/functions/_shared/score-input.ts`
- Create: `packages/domain/src/score-input.ts`
- Test: `packages/domain/src/score-input.test.ts`

**Interfaces:**
- Consumes: `GooglePlace` shape (campos `websiteUri`, `nationalPhoneNumber`/`internationalPhoneNumber`, `rating`, `userRatingCount`, `businessStatus`), `normalizeBrazilianPhone`, `hasRealWebsite`.
- Produces: `scoreInputFromPlace(place, distanceMeters): ScoreInput` — MESMA extração usada por execute-search e import-search-results.

- [ ] **Step 1: Escrever o teste (em packages/domain, que já roda `bun test`)**

```ts
// packages/domain/src/score-input.test.ts
import { expect, test } from "bun:test";
import { scoreInputFromPlace } from "./score-input";

test("sem site + telefone móvel → hasValidPhone e whatsapp possible", () => {
  const input = scoreInputFromPlace(
    {
      websiteUri: undefined,
      nationalPhoneNumber: "(21) 99999-8888",
      rating: 4.5,
      userRatingCount: 120,
      businessStatus: "OPERATIONAL",
    },
    3000,
  );
  expect(input.hasWebsite).toBe(false);
  expect(input.hasValidPhone).toBe(true);
  expect(input.whatsappStatus).toBe("possible");
  expect(input.hasEmail).toBe(false);
  expect(input.hasInstagram).toBe(false);
  expect(input.rating).toBe(4.5);
  expect(input.reviewCount).toBe(120);
  expect(input.distanceMeters).toBe(3000);
});

test("telefone fixo → whatsapp unknown", () => {
  const input = scoreInputFromPlace(
    { nationalPhoneNumber: "(21) 3333-4444", rating: null, userRatingCount: null },
    null,
  );
  expect(input.whatsappStatus).toBe("unknown");
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd packages/domain && bun test score-input`
Expected: FAIL ("Cannot find module './score-input'").

- [ ] **Step 3: Implementar o helper (packages/domain — versão testável)**

```ts
// packages/domain/src/score-input.ts
import type { ScoreInput } from "./score";
import { normalizeBrazilianPhone, hasRealWebsite } from "./normalize";

export interface PlaceLike {
  websiteUri?: string | null;
  nationalPhoneNumber?: string | null;
  internationalPhoneNumber?: string | null;
  rating?: number | null;
  userRatingCount?: number | null;
  businessStatus?: string | null;
}

/** Extração única de sinais de score a partir de um place. Reusada no
 * search-time (execute-search) e no import (import-search-results) para
 * garantir score idêntico nos dois caminhos. */
export function scoreInputFromPlace(place: PlaceLike, distanceMeters: number | null): ScoreInput {
  const rawPhone = place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null;
  const phone = rawPhone ? normalizeBrazilianPhone(rawPhone) : null;
  return {
    hasWebsite: hasRealWebsite(place.websiteUri ?? null),
    hasValidPhone: phone?.isValid ?? false,
    whatsappStatus: phone?.type === "mobile" ? "possible" : "unknown",
    hasEmail: false,
    hasInstagram: false,
    rating: place.rating ?? null,
    reviewCount: place.userRatingCount ?? null,
    distanceMeters,
    businessStatus: place.businessStatus ?? null,
  };
}
```

> Nota: se `packages/domain/src/normalize.ts` não exportar `hasRealWebsite`/`normalizeBrazilianPhone` com essas assinaturas, ajustar o import para o módulo correto do pacote (ver `packages/domain/src/index.ts`). As funções existem no shared das edge functions; o pacote domain é o mirror testado.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd packages/domain && bun test score-input`
Expected: PASS (2 testes).

- [ ] **Step 5: Espelhar no shared das edge functions (mesma lógica, imports Deno)**

```ts
// supabase/functions/_shared/score-input.ts
import type { ScoreInput } from "./score.ts";
import { normalizeBrazilianPhone, hasRealWebsite } from "./normalize.ts";
import type { GooglePlace } from "./google.ts";

export function scoreInputFromPlace(
  place: GooglePlace,
  distanceMeters: number | null,
): ScoreInput {
  const rawPhone = place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null;
  const phone = rawPhone ? normalizeBrazilianPhone(rawPhone) : null;
  return {
    hasWebsite: hasRealWebsite(place.websiteUri ?? null),
    hasValidPhone: phone?.isValid ?? false,
    whatsappStatus: phone?.type === "mobile" ? "possible" : "unknown",
    hasEmail: false,
    hasInstagram: false,
    rating: place.rating ?? null,
    reviewCount: place.userRatingCount ?? null,
    distanceMeters,
    businessStatus: place.businessStatus ?? null,
  };
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/domain/src/score-input.ts packages/domain/src/score-input.test.ts supabase/functions/_shared/score-input.ts
git commit -m "feat: shared scoreInputFromPlace helper for score parity"
```

### Task 4: Calcular score no `execute-search` e gravar em `search_results`

**Files:**
- Modify: `supabase/functions/execute-search/index.ts` (loop ~216-260 e upsert ~277-293)

**Interfaces:**
- Consumes: `scoreInputFromPlace`, `calculateScore`, `temperatureFromScore` de `_shared`.
- Produces: `search_results.score/temperature/score_breakdown` preenchidos na busca.

- [ ] **Step 1: Importar helpers no topo do arquivo**

```ts
import { calculateScore, temperatureFromScore } from "../_shared/score.ts";
import { scoreInputFromPlace } from "../_shared/score-input.ts";
```

- [ ] **Step 2: Estender o tipo de `meta` e calcular score no loop**

Modificar a declaração de `meta` (linha ~217) para carregar score:

```ts
const meta: {
  providerPlaceId: string;
  distance: number | null;
  inside: boolean;
  position: number;
  score: number;
  temperature: "hot" | "warm" | "cold";
  breakdown: unknown;
}[] = [];
```

No fim do bloco `for (const place of collected)`, logo antes de `meta.push(...)` (linha ~260), calcular:

```ts
const breakdown = calculateScore(scoreInputFromPlace(place, distance));
```

E trocar o push por:

```ts
meta.push({
  providerPlaceId: place.id!,
  distance,
  inside,
  position,
  score: breakdown.total,
  temperature: temperatureFromScore(breakdown.total),
  breakdown,
});
```

- [ ] **Step 3: Gravar score no upsert de `search_results`**

No `resultRows` (linha ~278), acrescentar os campos:

```ts
const resultRows = meta
  .filter((m) => idByProviderPlaceId.has(m.providerPlaceId))
  .map((m) => ({
    search_id: searchId,
    place_id: idByProviderPlaceId.get(m.providerPlaceId),
    distance_meters: m.distance,
    position: m.position,
    provider_rank: m.position,
    matched_query: search.query,
    is_inside_radius: m.inside,
    score: m.score,
    temperature: m.temperature,
    score_breakdown: m.breakdown,
  }));
```

- [ ] **Step 4: Typecheck do arquivo (Deno)**

Run: `cd /home/wendelsantos/works/leads && deno check supabase/functions/execute-search/index.ts`
Expected: `Check ...` sem erros.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/execute-search/index.ts
git commit -m "feat(functions): score search results at search time"
```

### Task 5: Desligar o auto-import (backend + frontend)

**Files:**
- Modify: `supabase/functions/execute-search/index.ts:304-322` (bloco `AUTO_IMPORT_LEADS`)
- Modify: `apps/web/src/hooks/useSearchMutation.ts:132`

**Interfaces:**
- Produces: buscas não criam mais leads automaticamente.

- [ ] **Step 1: Remover o bloco de auto-import do execute-search**

Apagar todo o bloco `if (Deno.env.get("AUTO_IMPORT_LEADS") !== "false") { ... }` (linhas ~304-322), incluindo o `try/catch` do `fetch` para `import-search-results`.

- [ ] **Step 2: Remover a chamada de import no frontend**

Em `apps/web/src/hooks/useSearchMutation.ts`, a linha 132 é:
```ts
const importResult = await repo.importResults(searchId, [], true);
```
Substituir a lógica que depende de `importResult.imported` para o `addedToPipeline`. Trocar por:
```ts
// Descoberta não materializa leads; o funil é povoado por ação do usuário.
```
E ajustar o `searchMeta` (linha ~136) para `addedToPipeline: 0` (nada é auto-adicionado):
```ts
addedToPipeline: 0,
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && npx tsc --noEmit -p tsconfig.json`
Expected: sem erros.
Run: `cd /home/wendelsantos/works/leads && deno check supabase/functions/execute-search/index.ts`
Expected: sem erros.

- [ ] **Step 4: Deploy do execute-search**

Run: `npx supabase functions deploy execute-search --project-ref zxneketqrapvbxyqewar --use-api`
Expected: "Deployed Functions."

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/execute-search/index.ts apps/web/src/hooks/useSearchMutation.ts
git commit -m "feat: stop auto-importing discovery results as leads"
```

> Após esta task o mapa fica sem dados até a Fase 3 subir (bloco atômico). Seguir direto para a Task 6.

---

## FASE 3 — Read-path de descoberta

### Task 6: RPC `get_search_discovery`

**Files:**
- Create: `supabase/migrations/20260723000003_get_search_discovery.sql`

**Interfaces:**
- Produces: RPC `get_search_discovery(p_search_id uuid) returns table(...)`.

- [ ] **Step 1: Escrever a migração da RPC**

```sql
create or replace function public.get_search_discovery(p_search_id uuid)
returns table (
  place_id uuid,
  name text,
  category text,
  latitude double precision,
  longitude double precision,
  national_phone_number text,
  website_uri text,
  has_website boolean,
  rating numeric,
  review_count integer,
  distance_meters integer,
  is_inside_radius boolean,
  score integer,
  temperature text,
  imported_lead_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id as place_id,
    p.name,
    p.primary_type as category,
    st_y(p.location::geometry) as latitude,
    st_x(p.location::geometry) as longitude,
    p.national_phone_number,
    p.website_uri,
    (p.website_uri is not null and p.website_uri <> '') as has_website,
    p.rating,
    p.user_rating_count as review_count,
    sr.distance_meters,
    sr.is_inside_radius,
    sr.score,
    sr.temperature,
    sr.imported_lead_id
  from public.search_results sr
  join public.places p on p.id = sr.place_id
  join public.searches s on s.id = sr.search_id
  where sr.search_id = p_search_id
    and public.is_organization_member(s.organization_id)
  order by sr.score desc nulls last, sr.distance_meters asc nulls last;
$$;
```

> Nota: confirmar o nome da coluna geográfica em `places` (`location`). Se o tipo for `geography(point)`, `::geometry` + `st_x/st_y` funcionam. Ajustar se o schema usar colunas `latitude/longitude` diretas.

- [ ] **Step 2: Aplicar e testar a RPC**

Run: `npx supabase db push --project-ref zxneketqrapvbxyqewar`
Expected: aplica sem erro.
Run (SQL editor, com um search_id real): `select * from get_search_discovery('<search_id>') limit 5;`
Expected: linhas com score/temperature preenchidos.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260723000003_get_search_discovery.sql
git commit -m "feat(db): get_search_discovery RPC"
```

### Task 7: Tipo `DiscoveryResult` + `getDiscovery` no repositório

**Files:**
- Modify: `apps/web/src/repositories/types.ts`
- Modify: `apps/web/src/repositories/supabase.ts`
- Modify: `apps/web/src/repositories/demo.ts`

**Interfaces:**
- Produces: `DiscoveryResult`, `SearchRepository.getDiscovery(searchId): Promise<DiscoveryResult[]>`.

- [ ] **Step 1: Definir o tipo e ampliar a interface**

Em `types.ts`:
```ts
export interface DiscoveryResult {
  placeId: string;
  name: string;
  category: string | null;
  latitude: number;
  longitude: number;
  phone: string | null;
  website: string | null;
  hasWebsite: boolean;
  rating: number | null;
  reviewCount: number | null;
  distanceKm: number;
  score: number;
  temperature: "hot" | "warm" | "cold";
  importedLeadId: string | null;
}
```
E adicionar à interface `SearchRepository` (após `getStatus`):
```ts
getDiscovery(searchId: string): Promise<DiscoveryResult[]>;
```

- [ ] **Step 2: Implementar no repositório Supabase**

Em `supabase.ts`, dentro da classe do SearchRepository:
```ts
async getDiscovery(searchId: string): Promise<DiscoveryResult[]> {
  const { data, error } = await getSupabase().rpc("get_search_discovery", {
    p_search_id: searchId,
  });
  if (error) throw new Error(error.message);
  return (data as Record<string, unknown>[]).map((r) => ({
    placeId: r.place_id as string,
    name: r.name as string,
    category: (r.category as string) ?? null,
    latitude: r.latitude as number,
    longitude: r.longitude as number,
    phone: (r.national_phone_number as string) ?? null,
    website: (r.website_uri as string) ?? null,
    hasWebsite: r.has_website as boolean,
    rating: (r.rating as number) ?? null,
    reviewCount: (r.review_count as number) ?? null,
    distanceKm: ((r.distance_meters as number) ?? 0) / 1000,
    score: (r.score as number) ?? 0,
    temperature: ((r.temperature as string) ?? "cold") as "hot" | "warm" | "cold",
    importedLeadId: (r.imported_lead_id as string) ?? null,
  }));
}
```

- [ ] **Step 3: Implementar stub no repositório demo**

Em `demo.ts`, no SearchRepository demo:
```ts
async getDiscovery(): Promise<DiscoveryResult[]> {
  // Demo continua usando o mock de leads; descoberta real é só no modo Supabase.
  return [];
}
```
(Importar `DiscoveryResult` de `./types`.)

- [ ] **Step 4: Typecheck**

Run: `cd apps/web && npx tsc --noEmit -p tsconfig.json`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/repositories/types.ts apps/web/src/repositories/supabase.ts apps/web/src/repositories/demo.ts
git commit -m "feat(web): DiscoveryResult type + getDiscovery repository method"
```

### Task 8: Hook `useDiscoveryResults`

**Files:**
- Modify: `apps/web/src/hooks/useLeadsQuery.ts` (adicionar o hook + query key)

**Interfaces:**
- Consumes: `getSearchRepository().getDiscovery`.
- Produces: `useDiscoveryResults(searchId?: string)` → `{ data: DiscoveryResult[] | undefined, ... }`.

- [ ] **Step 1: Adicionar a key e o hook**

```ts
import { getSearchRepository } from "@/repositories";
import type { DiscoveryResult } from "@/repositories/types";

export const discoveryKeys = {
  bySearch: (searchId: string) => ["discovery", searchId] as const,
};

export function useDiscoveryResults(searchId?: string) {
  return useQuery<DiscoveryResult[]>({
    queryKey: searchId ? discoveryKeys.bySearch(searchId) : ["discovery", "none"],
    queryFn: () => (searchId ? getSearchRepository().getDiscovery(searchId) : Promise.resolve([])),
    enabled: !!searchId,
    staleTime: 60_000,
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && npx tsc --noEmit -p tsconfig.json`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/useLeadsQuery.ts
git commit -m "feat(web): useDiscoveryResults hook"
```

### Task 9: Mapa + sidebar consomem descoberta

**Files:**
- Modify: `apps/web/src/routes/app.mapa.tsx`
- Modify: `apps/web/src/components/app/AppSidebar.tsx`
- Modify: `apps/web/src/components/app/MapView.tsx` (props aceitam `DiscoveryResult[]`)
- Modify: `apps/web/src/lib/filters.ts` (`filterByRadius` genérico sobre `{latitude,longitude}`)

**Interfaces:**
- Consumes: `useDiscoveryResults`, `DiscoveryResult`.
- Produces: mapa/lista da descoberta lêem `DiscoveryResult`, com filtro de raio client-side e indicador "já no funil" (`importedLeadId != null`).

- [ ] **Step 1: `filterByRadius` genérico**

Garantir que `filterByRadius` aceita itens com `latitude`/`longitude` (já é o caso). Confirmar assinatura:
```ts
export function filterByRadius<T extends { latitude: number; longitude: number }>(
  items: T[], center: LatLng, radiusKm: number,
): T[]
```
Se hoje é tipada só para `Lead`, generalizar para `T extends {latitude:number;longitude:number}`.

- [ ] **Step 2: `app.mapa.tsx` usa descoberta**

Trocar `useLeadsList(filters, sort, currentSearch?.id)` por:
```ts
const { data: discovery } = useDiscoveryResults(currentSearch?.id);
const allResults = useMemo(() => discovery ?? [], [discovery]);
```
Aplicar `filterByRadius(allResults, radiusCenter, radiusKm)` e passar o resultado para `<MapView results={...} />`. Remover o `applyFilters`/`sortLeads` sobre leads nessa rota (descoberta não usa os filtros de CRM; ordenação já vem da RPC por score).

- [ ] **Step 3: `MapView` aceita `DiscoveryResult[]`**

Renomear a prop `leads: Lead[]` para `results: DiscoveryResult[]`. Ajustar `markerIcon`/`popupHtml` para usar campos de `DiscoveryResult` (`name`, `category`, `score`, `temperature`, `distanceKm`, `hasWebsite`, `phone`, `website`, `importedLeadId`). Onde hoje usa `lead.companyName` → `result.name`, `lead.stage` (não existe em discovery) → usar `importedLeadId != null` para o estado "no funil".

- [ ] **Step 4: `AppSidebar` lista descoberta**

Trocar `useLeadsList(filters, sort, currentSearch?.id)` por `useDiscoveryResults(currentSearch?.id)`. O resumo (sem site / canais) passa a contar sobre `DiscoveryResult` (`hasWebsite`, `phone`). O `LeadCard` da lista de descoberta: usar um card de descoberta (pode ser um `DiscoveryCard` novo minimalista) OU adaptar `LeadCard` para aceitar um modo discovery. Escolha: criar `DiscoveryCard` (nome, categoria, score/temperatura via força-de-sinal, distância, botões WhatsApp/+Funil/Detalhes) para não sobrecarregar `LeadCard`.

- [ ] **Step 5: Typecheck + verificação visual**

Run: `cd apps/web && npx tsc --noEmit -p tsconfig.json`
Expected: sem erros.
Verificação manual (preview): buscar → mapa mostra resultados com score; `select count(*) from leads` não aumenta.

- [ ] **Step 6: Reconciliar memória e remover searchId obsoleto**

Em `useLeadsQuery.ts`, remover o parâmetro `searchId` de `useLeadsList` (não é mais usado por ninguém após a migração do mapa) — confirmar via `grep -rn "useLeadsList(" apps/web/src` que só Kanban/Painel/sidebar-CRM o chamam sem searchId. Atualizar `memory/leads-table-dual-purpose-scoping.md` para refletir que o mapa agora lê descoberta.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): map + sidebar read discovery instead of leads"
```

---

## FASE 4 — Adicionar ao funil

### Task 10: `import-search-results` aceita `stage`

**Files:**
- Modify: `supabase/functions/import-search-results/index.ts`

**Interfaces:**
- Consumes: input `{ searchId, placeIds, importAll, stage? }`.
- Produces: lead criado com `stage` alvo; duplicado nunca rebaixa.

- [ ] **Step 1: Ampliar o schema de input**

```ts
const InputSchema = z.object({
  searchId: z.string().uuid(),
  placeIds: z.array(z.string().uuid()).max(200).default([]),
  importAll: z.boolean().default(false),
  stage: z.enum(["new", "qualified", "contacted"]).default("new"),
});
```

- [ ] **Step 2: Usar `stage` no insert e nunca rebaixar duplicado**

No insert do lead (linha ~157-183), trocar `stage: "new"` por `stage: input.stage`.
No ramo de duplicado (linha ~129-138), quando `input.stage` for "mais avançado" que o atual, promover:
```ts
if (existing) {
  duplicates++;
  const rank = { new: 0, qualified: 1, contacted: 2, won: 3, discarded: -1 } as Record<string, number>;
  // Promove, nunca rebaixa.
  const { data: cur } = await ctx.adminClient
    .from("leads").select("stage").eq("id", existing.id).maybeSingle();
  if (cur && (rank[input.stage] ?? 0) > (rank[cur.stage as string] ?? 0)) {
    await ctx.adminClient.from("leads")
      .update({ stage: input.stage, last_interaction_at: new Date().toISOString() })
      .eq("id", existing.id);
  }
  await ctx.adminClient.from("search_results")
    .update({ imported_lead_id: existing.id })
    .eq("search_id", input.searchId).eq("place_id", row.place_id);
  continue;
}
```

- [ ] **Step 3: Typecheck + deploy**

Run: `cd /home/wendelsantos/works/leads && deno check supabase/functions/import-search-results/index.ts`
Expected: sem erros.
Run: `npx supabase functions deploy import-search-results --project-ref zxneketqrapvbxyqewar --use-api`
Expected: "Deployed Functions."

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/import-search-results/index.ts
git commit -m "feat(functions): import-search-results accepts target stage"
```

### Task 11: Ação `addToFunnel` no repositório + botões

**Files:**
- Modify: `apps/web/src/repositories/types.ts` (interface), `supabase.ts`, `demo.ts`
- Modify: `apps/web/src/components/app/DiscoveryCard.tsx` (criado na Task 9) e `MapView.tsx` (popup)

**Interfaces:**
- Produces: `SearchRepository.addToFunnel(searchId, placeId, stage): Promise<void>`.

- [ ] **Step 1: Interface + impl**

Em `types.ts` (interface SearchRepository):
```ts
addToFunnel(searchId: string, placeId: string, stage: "new" | "contacted"): Promise<void>;
```
Em `supabase.ts`:
```ts
async addToFunnel(searchId: string, placeId: string, stage: "new" | "contacted"): Promise<void> {
  await invokeFunction("import-search-results", { searchId, placeIds: [placeId], stage });
}
```
Em `demo.ts`: stub `async addToFunnel() {}`.

- [ ] **Step 2: Mutation hook + botões**

Criar `useAddToFunnelMutation` (invalida `leadKeys.all` e `discoveryKeys.bySearch(searchId)`). No `DiscoveryCard` e no popup do `MapView`:
- Botão **+Funil** → `addToFunnel(searchId, placeId, "new")`.
- Botão **WhatsApp** → `addToFunnel(searchId, placeId, "contacted")` e então `window.open(wa.me/...)`.
- Quando `importedLeadId != null`: botão vira "No funil" (desabilitado/estado distinto).

- [ ] **Step 3: Typecheck + verificação manual**

Run: `cd apps/web && npx tsc --noEmit -p tsconfig.json`
Expected: sem erros.
Manual: +Funil → lead aparece no Kanban "Novo"; WhatsApp → lead em "Contatado" + abre wa.me; marcador vira "No funil".

- [ ] **Step 4: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): add-to-funnel actions from discovery"
```

### Task 12: Disparo em massa materializa leads

**Files:**
- Modify: `apps/web/src/components/app/BulkBar.tsx` e o fluxo de "Iniciar prospecção em massa" / `MessageTemplateDialog`

**Interfaces:**
- Consumes: `addToFunnel`; seleção agora é de `placeId`s da descoberta.

- [ ] **Step 1: Seleção sobre place ids**

Garantir que o modo bulk seleciona `placeId`s de `DiscoveryResult` (não lead ids). Ajustar `selectVisible`/`selectedIds` para operar sobre place ids da descoberta.

- [ ] **Step 2: Materializar antes de disparar**

No handler de "Iniciar prospecção em massa": para cada `placeId` selecionado, `await addToFunnel(searchId, placeId, "contacted")` (em lote, com `Promise.all` limitado), então abrir o fluxo de mensagens.

- [ ] **Step 3: Typecheck + manual**

Run: `cd apps/web && npx tsc --noEmit -p tsconfig.json`
Expected: sem erros.
Manual: selecionar N na descoberta → disparar → N leads em "Contatado".

- [ ] **Step 4: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): bulk prospecting materializes leads as contacted"
```

---

## FASE 5 — Enriquecimento sob demanda

### Task 13: Disparar `enrich-lead` ao entrar no funil

**Files:**
- Modify: `supabase/functions/import-search-results/index.ts` (após criar o lead) OU `apps/web` (após `addToFunnel`)

**Interfaces:**
- Consumes: função `enrich-lead` existente (recebe `leadId`).

- [ ] **Step 1: Retornar o leadId criado**

`import-search-results` passa a retornar os `{ placeId, leadId }` criados no response, para o front saber quem enriquecer. Ajustar o JSON de resposta.

- [ ] **Step 2: Enriquecer no cliente após addToFunnel**

Em `useAddToFunnelMutation.onSuccess`, se veio `leadId` e o place tem `website`, chamar `invokeFunction("enrich-lead", { leadId })` (fire-and-forget, sem bloquear a UI). Invalidar `leadKeys.all` de novo quando terminar.

- [ ] **Step 3: Typecheck + deploy + manual**

Run: `cd apps/web && npx tsc --noEmit -p tsconfig.json`
Run: `npx supabase functions deploy import-search-results --project-ref zxneketqrapvbxyqewar --use-api`
Manual: +Funil numa empresa com site → após alguns segundos, telefone/email/whatsapp enriquecidos no lead.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/import-search-results/index.ts apps/web/src
git commit -m "feat: enrich lead on demand when added to funnel"
```

---

## Self-Review (cobertura do spec)

- §3.1 colunas score → Task 1 ✓
- §3.2 limpeza → Task 2 ✓
- §4 scoring search-time + desliga import → Tasks 3,4,5 ✓
- §5 read-path descoberta (RPC, tipo, repo, hook, mapa/sidebar, indicador "no funil") → Tasks 6,7,8,9 ✓
- §5.3 reconciliação memória / remover searchId → Task 9 Step 6 ✓
- §6 add-to-funnel (stage, +Funil/WhatsApp/bulk, nunca rebaixa) → Tasks 10,11,12 ✓
- §7 Kanban/Painel sem mudança → garantido por não tocar `useLeadsList` deles ✓
- §8 testes (paridade score, predicado migração, manual) → Task 3 (paridade), Task 2 Step 3 (sanidade migração), manuais nas tasks ✓
- §9 ordem → Fases 1-5 na ordem; bloco atômico 1-3 sinalizado ✓
- §10 riscos (paridade, bulk, transação, RLS, migração destrutiva) → paridade via helper compartilhado (Task 3), bulk (Task 12), RLS (Task 6 security definer), migração (Task 2 rodar em staging antes) ✓
