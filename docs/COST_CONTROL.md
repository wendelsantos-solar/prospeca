# Controle de custos — Radar Local

## Camadas de proteção

1. **Quota mensal por organização** — `organizations.monthly_search_limit`
   (default 20) e `monthly_place_limit` (default 500). Verificadas por
   `get_quota_status` antes de qualquer chamada externa.
2. **Rate limit por minuto** — `assertRateLimit` (janela deslizante sobre
   `usage_events`): busca 5/min, geocode 10/min, details 20/min, export 3/min.
3. **Limite técnico absoluto** — máx. 3 páginas de Text Search por execução
   (`ABSOLUTE_MAX_PAGES`), máx. 60 resultados por busca, máx. 20 places por
   chamada de refresh.
4. **Idempotência** — `idempotency_keys` bloqueia duplo clique / reenvio.
5. **Cache** — `geocode_cache` (30 dias) evita geocodificação repetida;
   `provider_refresh_after` (30 dias) impede refresh de detalhes recentes.
6. **FieldMask mínimo** — sem fotos/reviews (SKUs caros).

## Registro de consumo

Toda chamada externa grava `usage_events`:

| event_type              | quando                            |
| ----------------------- | --------------------------------- |
| `search_request`        | criação de busca                  |
| `place_search_request`  | cada página de Text/Nearby Search |
| `place_details_request` | cada Place Details                |
| `geocode_request`       | cada geocodificação não cacheada  |
| `export_record`         | linhas exportadas                 |

## Estimativa pré-busca

O frontend deve exibir antes de executar: limite de resultados da busca,
quota restante no mês (via `get_quota_status`) e aviso quando a busca puder
consumir muitos créditos. Valores financeiros exatos **não** são exibidos —
dependem da tabela vigente do Google (interface `ProviderUsageEstimator`
prevista para quando houver cálculo confiável).

## Score (referência de auditoria)

Regra `v1.0.0` (`supabase/functions/_shared/score.ts`, espelho em
`src/lib/score.ts`): sem website +25, telefone válido +15, WhatsApp
possível/verificado +10, e-mail +10, Instagram +5, nota ≥4,0 +10,
≥20 avaliações +10, ≥100 avaliações +5, ≤10 km +5, operacional +5.
Clamp 0–100. Temperatura: hot ≥75, warm ≥45, cold <45. Breakdown salvo em
`leads.score_breakdown` com `score_rule_version`.
