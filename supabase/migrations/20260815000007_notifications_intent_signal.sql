-- Fase 6 — kind 'intent_signal' nas notificações (spec #56, #60).
--
-- DESVIO TÉCNICO do "sem migrations novas": a constraint CHECK de
-- notifications.kind criada em 20260813000006 não inclui 'intent_signal' —
-- sem esta alteração o upsert do get-notifications falharia em runtime.
-- Mínima: drop + add da MESMA constraint com a lista estendida.

alter table public.notifications
  drop constraint if exists notifications_kind_check;

alter table public.notifications
  add constraint notifications_kind_check
  check (kind in (
    'overdue_activity',
    'stalled_lead',
    'unanswered_proposal',
    'deal_won',
    'intent_signal',
    'info'
  ));
