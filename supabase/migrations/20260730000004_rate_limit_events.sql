-- Radar Local — contador dedicado de rate limiting.
--
-- MOTIVO (bug corrigido): `_shared/rate-limit.ts` gravava o contador em
-- `usage_events` com `event_type = 'rate_limit_*'`. Mas `usage_events.event_type`
-- tem CHECK restrito a 6 tipos de custo
-- ('search_request','place_search_request','place_details_request',
--  'geocode_request','enrichment_request','export_record').
-- Todo INSERT violava o CHECK, o erro não era verificado, o contador nunca
-- incrementava e a contagem voltava sempre 0 — ou seja, o rate limit de
-- accept-invitation, submit-feedback e create-pilot NUNCA disparava.
--
-- Além disso o escopo do contador era `organization_id` (FK obrigatória para
-- organizations), o que não serve para operações que acontecem ANTES de existir
-- uma organização resolvida (aceitar convite) ou que são por usuário
-- (create-pilot). Aqui o escopo é um `scope_key` textual opaco
-- ('user:<uuid>', 'org:<uuid>', 'email:<hash>'), sem FK.
--
-- Separação de responsabilidades:
--   usage_events         -> consumo faturável / custo (fonte de quota e billing)
--   rate_limit_events    -> throttle antiabuso (técnico, descartável)
-- Não misturar os dois: rate limit poluiria a base de custo.

create table if not exists public.rate_limit_events (
  id bigserial primary key,
  -- Escopo opaco: 'user:<uuid>' | 'org:<uuid>' | 'email:<sha256>' | 'global'.
  -- Sem FK de propósito: precisa funcionar pré-organização.
  scope_key text not null,
  operation text not null,
  created_at timestamptz not null default now()
);

-- Índice que serve exatamente a query da janela deslizante.
create index if not exists idx_rate_limit_scope_op_created
  on public.rate_limit_events (scope_key, operation, created_at desc);

-- RLS ligada e SEM policies: nenhum cliente (anon/authenticated) lê ou escreve.
-- Apenas service_role (que faz bypass de RLS) toca esta tabela, a partir das
-- edge functions. Defesa em profundidade: além da ausência de policies,
-- revogamos explicitamente os grants que `alter default privileges`
-- (20260720000003_service_role_grants.sql) concede a novas tabelas.
alter table public.rate_limit_events enable row level security;
revoke all on public.rate_limit_events from anon, authenticated;
revoke all on sequence public.rate_limit_events_id_seq from anon, authenticated;
grant select, insert, delete on public.rate_limit_events to service_role;
grant usage, select on sequence public.rate_limit_events_id_seq to service_role;

-- Expurgo: a tabela só precisa da janela recente. Sem isso ela cresce sem
-- limite e o índice degrada.
create or replace function public.purge_rate_limit_events()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  delete from public.rate_limit_events
   where created_at < now() - interval '1 day';
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Mesmo idioma condicional das outras migrations de cron: aplica mesmo sem
-- pg_cron habilitado (função fica criada, só reexecutar o agendamento depois).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'purge-rate-limit-events') then
      perform cron.unschedule('purge-rate-limit-events');
    end if;
    perform cron.schedule(
      'purge-rate-limit-events',
      '17 * * * *',
      'select public.purge_rate_limit_events();'
    );
  else
    raise notice 'pg_cron ausente — purge_rate_limit_events() criada mas NÃO agendada.';
  end if;
end $$;
