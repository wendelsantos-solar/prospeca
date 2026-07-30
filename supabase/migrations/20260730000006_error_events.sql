-- Radar Local — tabela de erros para observabilidade em produção.
--
-- MOTIVO: sem error tracking, erro de piloto real é invisível. Todo o valor do
-- beta privado é aprender com uso real, e sem visibilidade de erro isso é
-- impossível. Escolha deliberada: tabela própria no Postgres em vez de Sentry.
--
-- Vantagens:
--   - Zero dependência nova, zero custo
--   - Testável com os mesmos testes de RLS que já existem
--   - Correlacionável por requestId, release, organization_id
--   - Adapter documentado para trocar por Sentry depois se necessário
--
-- Separação de responsabilidades:
--   usage_events    -> produto / analytics / custo
--   error_events    -> observabilidade técnica (erros de runtime)

create table if not exists public.error_events (
  id bigserial primary key,
  -- Origem: 'browser' | 'edge-function' | 'db-trigger'
  source text not null check (source in ('browser', 'edge-function', 'db-trigger')),

  -- Nome da função / componente / rota onde o erro ocorreu.
  -- Ex: 'execute-search', 'AppLayout', 'get_dashboard_overview'
  location text,

  -- Mensagem sanitizada (nunca inclui payload completo, tokens ou PII).
  message text not null,

  -- Stack trace (pode ser vazio em erros de rede ou CORS).
  stack text,

  -- Severidade: 'error' (inesperado, requer atenção) | 'warn' (degradado mas funcional)
  severity text not null default 'error' check (severity in ('error', 'warn')),

  -- Erro estruturado como JSONB — só campos que não carregam PII:
  -- { code, status, endpoint, operation, ... }
  -- Nunca: body da request, headers, tokens, dados do tenant.
  context jsonb,

  -- Para correlação com logs: o requestId do log estruturado.
  request_id text,

  -- Para isolar por tenant e por release.
  organization_id uuid references public.organizations(id) on delete set null,
  release text,

  -- Metadados de ambiente.
  environment text not null default 'production' check (environment in ('development', 'staging', 'production')),
  user_agent text,

  created_at timestamptz not null default now()
);

-- Índices para as queries que o painel de admin vai fazer.
create index if not exists idx_error_events_created_at
  on public.error_events (created_at desc);

create index if not exists idx_error_events_org_created
  on public.error_events (organization_id, created_at desc);

create index if not exists idx_error_events_source_severity
  on public.error_events (source, severity, created_at desc);

create index if not exists idx_error_events_location
  on public.error_events (location, created_at desc);

-- RLS: autenticado só insere (anon não escreve erro), ninguém lê exceto
-- service_role (painel admin e edge functions). Defesa em profundidade:
-- erros podem conter detalhes internos que não devem ser expostos ao cliente.
alter table public.error_events enable row level security;

-- Policy de INSERT: qualquer usuário autenticado pode reportar erro.
-- A sanitização é responsabilidade do chamador (browser e edge functions).
-- Se o erro acontece em contexto de organização, organization_id vem preenchido;
-- se pré-organização (ex: signup quebrado), vem null.
create policy error_events_insert on public.error_events for insert
  with check (
    auth.uid() is not null
    and (
      -- Se reporta erro para uma organização, precisa ser membro dela.
      organization_id is null
      or public.is_organization_member(organization_id)
    )
  );

-- Nenhuma policy de SELECT: cliente NUNCA lê erros (pode conter detalhes
-- internos). Só service_role (bypass de RLS) e edge functions leem.
revoke select on public.error_events from anon, authenticated;

-- Grants: autenticado só insere.
revoke all on public.error_events from anon, authenticated;
revoke all on sequence public.error_events_id_seq from anon, authenticated;
grant insert on public.error_events to authenticated;
grant usage, select on sequence public.error_events_id_seq to authenticated;
grant select, insert, delete on public.error_events to service_role;
grant usage, select on sequence public.error_events_id_seq to service_role;

-- Expurgo: erros com mais de 90 dias são descartados. O beta não precisa de
-- retenção longa de erro; se quiser manter histórico, é só aumentar o intervalo.
create or replace function public.purge_error_events()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  delete from public.error_events
   where created_at < now() - interval '90 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'purge-error-events') then
      perform cron.unschedule('purge-error-events');
    end if;
    perform cron.schedule(
      'purge-error-events',
      '23 3 * * *',
      'select public.purge_error_events();'
    );
  else
    raise notice 'pg_cron ausente — purge_error_events() criada mas NÃO agendada.';
  end if;
end $$;
