# Banco de dados — Radar Local

Migrations em `supabase/migrations/` (ordem numérica). Nunca alterar o schema
manualmente — sempre via nova migration.

## Aplicar

```bash
supabase link --project-ref <ref>
supabase db push
```

## Migrations

| Arquivo                 | Conteúdo                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `..._core.sql`          | extensões (pgcrypto, postgis), organizations, organization_members, profiles, trigger de signup, `is_organization_member` |
| `..._search_places.sql` | searches, places (dados do provedor), search_results                                                                      |
| `..._crm.sql`           | leads, lead_notes, lead_activities, lead_stage_history, message_templates + índices                                       |
| `..._ops.sql`           | audit_logs, usage_events, idempotency_keys, suppression_list, exports, geocode_cache                                      |
| `..._rls.sql`           | RLS + policies de todas as tabelas                                                                                        |
| `..._rpcs.sql`          | `search_leads_within_radius`, `leads_within_bounds`, `move_lead_stage`, `get_dashboard_overview`, `get_quota_status`      |

## Decisões

- `places` guarda o dado bruto do provedor com `provider_fetched_at` /
  `provider_refresh_after` (TTL 30 dias) — retenção respeita a licença do Google.
- `leads` é a entidade comercial interna; importação copia campos permitidos e
  nunca é sobrescrita por atualizações automáticas do provedor.
- Dedupe garantido por índice único parcial `(organization_id, place_id)` +
  índices em `phone_e164` e `website_domain`.
- `lead_stage_history` registra toda transição (via RPC `move_lead_stage`,
  atômica com validação de won/discarded).
- `geocode_cache` evita re-geocodificar o mesmo rótulo (TTL 30 dias).

## Seed de desenvolvimento

`supabase/seed/dev_seed.sql` — cria leads fictícios marcados com
`source='demo_seed'` e sufixo `[DEMO]`. Nunca executar em produção.
