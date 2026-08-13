-- Notificações server-side — derivadas do funil, persistidas por usuário.
--
-- Motivação: o sininho era derivado 100% no cliente e o estado lido/descartado
-- vivia em localStorage, então "marcar como lida" não sobrevivia a reload e não
-- sincronizava entre aparelhos. Com esta tabela o `read_at`/`dismissed_at` ficam
-- no banco (multi-dispositivo) e o cliente lê a tabela em vez de re-scanear a
-- lista completa de leads (payload menor no sininho).
--
-- A geração é feita por `get-notifications` (edge function), que roda a MESMA
-- regra pura de `packages/domain/src/notifications.ts` e faz upsert preservando
-- read_at/dismissed_at (ON CONFLICT atualiza só título/descrição).

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in (
    'overdue_activity',
    'stalled_lead',
    'unanswered_proposal',
    'deal_won',
    'info'
  )),
  title text not null,
  description text,
  lead_id uuid references public.leads(id) on delete cascade,
  notification_key text not null,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, notification_key)
);

create index idx_notifications_org_user
  on public.notifications (organization_id, user_id, read_at);

create index idx_notifications_lead on public.notifications (lead_id);

create trigger trg_notifications_updated before update on public.notifications
  for each row execute function public.set_updated_at();

alter table public.notifications enable row level security;

-- Cada usuário lê/atualiza/apaga SOMENTE as próprias notificações da própria org.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and policyname = 'notifications_select_own'
  ) then
    create policy notifications_select_own on public.notifications
      for select using (public.is_organization_member(organization_id) and user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and policyname = 'notifications_update_own'
  ) then
    create policy notifications_update_own on public.notifications
      for update using (public.is_organization_member(organization_id) and user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and policyname = 'notifications_delete_own'
  ) then
    create policy notifications_delete_own on public.notifications
      for delete using (public.is_organization_member(organization_id) and user_id = auth.uid());
  end if;
end$$;
