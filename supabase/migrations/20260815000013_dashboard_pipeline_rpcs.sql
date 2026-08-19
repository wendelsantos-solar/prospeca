-- ============================================================================
-- FASE 4 — CARTEIRA COMERCIAL OPERÁVEL
-- Migration NOVA (additive, idempotente, re-executável). NÃO edita migrations
-- anteriores.
--
-- 4.1 — get_lead_stage_counts: totais por estágio vindos do SERVIDOR (COUNT),
--   para o Kanban nunca mostrar contagem derivada de array truncado.
-- 4.2 — get_dashboard_overview ESTENDIDA (mesma assinatura, retrocompatível):
--   os campos existentes ficam exatamente como eram; adiciona o que o painel
--   precisava e que hoje é agregado no cliente sobre o array truncado de 50:
--   enrichedCount, respondedCount, meetingCount, proposalCount,
--   discardedCount, pipelineCount, pipelineValueWindowed, channels, dailySeries
--   (últimos 30 dias da janela), qualificados/contatados/receita por cidade e
--   categoria, e allTime (funnel inteiro para a Prova de Valor).
--   A RPC NÃO é security definer e NÃO vira internal-only: continua chamada
--   pelo browser com o membership check que já tinha (Fase 1 intacta).
-- 4.3 — list_organization_members + assign_lead: expor responsável com
--   validação de membership. TODAS as RPCs novas têm membership check e ACL
--   deny-by-default (revoke de public/anon, grant a authenticated+service_role
--   — browser path), sem reintroduzir o padrão da Fase 1.
-- ============================================================================

-- ── 4.1: contagens por estágio do servidor ──────────────────────────────────
create or replace function public.get_lead_stage_counts(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_organization_member(p_organization_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total', coalesce(sum(c), 0),
    'byStage', coalesce(jsonb_object_agg(stage, c), '{}'::jsonb)
  )
  into result
  from (
    select stage, count(*) c
    from public.leads
    where organization_id = p_organization_id
    group by stage
  ) s;

  return result;
end;
$$;

revoke execute on function public.get_lead_stage_counts(uuid) from public, anon;
grant execute on function public.get_lead_stage_counts(uuid) to authenticated, service_role;

-- ── 4.1b: contagens de HOJE/ATRASADAS do servidor (badge da navegação) ─────
-- Espelha a lógica de buildTodayGroups (apps/web/src/lib/today.ts) para as
-- contagens exibidas em badge: atividades abertas (date não-nula, done=false)
-- vencidas/do dia + primeiras abordagens + passos de cadência devidos
-- (D+2/D+4/D+7/D+14 ancorados em cadence_started_at, mesmo domínio).
create or replace function public.get_today_counts(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
  v_today_start timestamptz := date_trunc('day', now());
  v_today_end timestamptz := date_trunc('day', now()) + interval '1 day' - interval '1 microsecond';
begin
  if not public.is_organization_member(p_organization_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'today', coalesce((
      select count(*)
      from (
        -- Atividades abertas do dia (scheduled_at + status != completed)
        select l.id
        from public.leads l
        join public.lead_activities a on a.lead_id = l.id
        where l.organization_id = p_organization_id
          and l.stage not in ('won', 'discarded')
          and a.scheduled_at is not null and a.status <> 'completed'
          and a.scheduled_at >= v_today_start and a.scheduled_at <= v_today_end
        union all
        -- Passos de cadência devidos hoje (contatados, cadência ativa)
        select l.id
        from public.leads l
        where l.organization_id = p_organization_id
          and l.stage = 'contacted'
          and l.cadence_started_at is not null
          and l.cadence_completed_at is null
          and coalesce(l.cadence_step, 0) < 4
          and (l.cadence_started_at::date +
            (case when coalesce(l.cadence_step, 0) = 0 then 2
                  when l.cadence_step = 1 then 4
                  when l.cadence_step = 2 then 7
                  else 14 end)::int
          ) between v_today_start::date and v_today_end::date
      ) t
    ), 0),
    'overdue', coalesce((
      select count(*)
      from (
        select l.id
        from public.leads l
        join public.lead_activities a on a.lead_id = l.id
        where l.organization_id = p_organization_id
          and l.stage not in ('won', 'discarded')
          and a.scheduled_at is not null and a.status <> 'completed'
          and a.scheduled_at < v_today_start
        union all
        select l.id
        from public.leads l
        where l.organization_id = p_organization_id
          and l.stage = 'contacted'
          and l.cadence_started_at is not null
          and l.cadence_completed_at is null
          and coalesce(l.cadence_step, 0) < 4
          and (l.cadence_started_at::date +
            (case when coalesce(l.cadence_step, 0) = 0 then 2
                  when l.cadence_step = 1 then 4
                  when l.cadence_step = 2 then 7
                  else 14 end)::int
          ) < v_today_start::date
      ) t
    ), 0),
    'firstReach', coalesce((
      select count(*)
      from public.leads l
      where l.organization_id = p_organization_id
        and l.stage = 'new'
        and l.last_interaction_at is null
        and not exists (
          select 1 from public.lead_activities a
          where a.lead_id = l.id and a.scheduled_at is not null and a.status <> 'completed'
        )
    ), 0)
  ) into result;

  return result;
end;
$$;

revoke execute on function public.get_today_counts(uuid) from public, anon;
grant execute on function public.get_today_counts(uuid) to authenticated, service_role;

-- ── 4.1c: resolve_lead_batch — seleção em lote sem perda silenciosa ────────
-- BulkBar/RouteDialog resolvem a seleção contra as páginas CARREGADAS; quando
-- o infinite reseta de página, IDs de páginas descarregadas somiam da ação em
-- lote SEM AVISO (P2 da 4d). Esta RPC resolve os IDs restantes no SERVIDOR,
-- escopada pela organização do chamador (membership gate com RAISE — negação
-- explícita, não linha vazia) — o cliente nunca opera sobre seleção parcial
-- sem saber.
create or replace function public.resolve_lead_batch(p_organization_id uuid, p_ids uuid[])
returns table (
  id uuid,
  company_name text,
  category text,
  address text,
  neighborhood text,
  city text,
  state text,
  latitude numeric,
  longitude numeric,
  phone text,
  whatsapp text,
  email text,
  instagram text,
  has_website boolean,
  rating numeric,
  review_count integer,
  temperature text,
  stage text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_organization_member(p_organization_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
  select l.id, l.company_name, l.category, l.address, l.neighborhood, l.city,
         l.state, l.latitude, l.longitude, l.phone, l.whatsapp, l.email,
         l.instagram, l.has_website, l.rating, l.review_count, l.temperature,
         l.stage
  from public.leads l
  where l.organization_id = p_organization_id
    and l.id = any(p_ids)
  order by l.created_at desc;
end;
$$;

revoke execute on function public.resolve_lead_batch(uuid, uuid[]) from public, anon;
grant execute on function public.resolve_lead_batch(uuid, uuid[]) to authenticated, service_role;

-- ── 4.3: membros da organização (para atribuição) ───────────────────────────
create or replace function public.list_organization_members(p_organization_id uuid)
returns table (user_id uuid, full_name text, role text, email text)
language sql
stable
security definer
set search_path = public
as $$
  select m.user_id, p.full_name, m.role, u.email
  from public.organization_members m
  join public.profiles p on p.id = m.user_id
  join auth.users u on u.id = m.user_id
  where m.organization_id = p_organization_id
    and public.is_organization_member(p_organization_id)
  order by p.full_name nulls last;
$$;

revoke execute on function public.list_organization_members(uuid) from public, anon;
grant execute on function public.list_organization_members(uuid) to authenticated, service_role;

-- ── 4.3: atribuir lead — valida que o alvo é membro da MESMA org ────────────
create or replace function public.assign_lead(p_lead_id uuid, p_assigned_to uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.leads where id = p_lead_id;
  if v_org is null then
    raise exception 'LEAD_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not public.is_organization_member(v_org) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  -- Atribuição só para membro da MESMA organização (protege contra injeção de
  -- uuid de usuário de outro tenant).
  if p_assigned_to is not null and not exists (
    select 1 from public.organization_members
    where organization_id = v_org and user_id = p_assigned_to
  ) then
    raise exception 'ASSIGNEE_NOT_MEMBER' using errcode = '42501';
  end if;

  update public.leads set assigned_to = p_assigned_to where id = p_lead_id;
end;
$$;

revoke execute on function public.assign_lead(uuid, uuid) from public, anon;
grant execute on function public.assign_lead(uuid, uuid) to authenticated, service_role;

-- ── 4.2: painel sobre a carteira inteira ────────────────────────────────────
create or replace function public.get_dashboard_overview(
  p_organization_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz
)
returns jsonb
language plpgsql
stable
as $$
declare
  result jsonb;
begin
  if not public.is_organization_member(p_organization_id) then
    raise exception 'FORBIDDEN';
  end if;

  with scoped as (
    select * from public.leads
    where organization_id = p_organization_id
      and created_at >= p_start_date and created_at < p_end_date
  ),
  won as (
    select * from public.leads
    where organization_id = p_organization_id
      and stage = 'won'
      and closed_at >= p_start_date and closed_at < p_end_date
  )
  select jsonb_build_object(
    'totalLeads', (select count(*) from scoped),
    'byStage', (select coalesce(jsonb_object_agg(stage, c), '{}'::jsonb)
      from (select stage, count(*) c from scoped group by stage) s),
    'byStageValue', (select coalesce(jsonb_object_agg(stage, v), '{}'::jsonb)
      from (select stage, coalesce(sum(case when stage = 'won' then closed_value else estimated_value end), 0) v
            from scoped group by stage) s),
    'byTemperature', (select coalesce(jsonb_object_agg(temperature, c), '{}'::jsonb)
      from (select temperature, count(*) c from scoped group by temperature) s),
    'byCity', (select coalesce(jsonb_agg(jsonb_build_object(
        'city', city, 'count', c, 'won', w, 'qualified', q, 'contacted', ct, 'revenue', rev
      ) order by c desc), '[]'::jsonb)
      from (select city, count(*) c,
              count(*) filter (where stage = 'won') w,
              count(*) filter (where stage = 'qualified') q,
              count(*) filter (where stage = 'contacted') ct,
              coalesce(sum(closed_value) filter (where stage = 'won'), 0) rev
            from scoped where city is not null group by city limit 20) s),
    'byCategory', (select coalesce(jsonb_agg(jsonb_build_object(
        'category', category, 'count', c, 'won', w, 'qualified', q, 'contacted', ct, 'revenue', rev
      ) order by c desc), '[]'::jsonb)
      from (select category, count(*) c,
              count(*) filter (where stage = 'won') w,
              count(*) filter (where stage = 'qualified') q,
              count(*) filter (where stage = 'contacted') ct,
              coalesce(sum(closed_value) filter (where stage = 'won'), 0) rev
            from scoped where category is not null group by category limit 20) s),
    'contacted', (select count(*) from scoped where stage in ('contacted','won')),
    'wonCount', (select count(*) from won),
    'wonValue', (select coalesce(sum(closed_value), 0) from won),
    'avgTicket', (select coalesce(avg(closed_value), 0) from won),
    'pipelineValue', (select coalesce(sum(estimated_value), 0) from public.leads
      where organization_id = p_organization_id and stage in ('qualified','contacted')),
    'avgDaysToClose', (select coalesce(avg(extract(epoch from (closed_at - created_at)) / 86400), 0) from won),
    'conversionRate', (select case when count(*) = 0 then 0
      else round(count(*) filter (where stage = 'won')::numeric / count(*) * 100, 1) end from scoped),
    'searchCount', (select count(*) from public.searches
      where organization_id = p_organization_id
        and created_at >= p_start_date and created_at < p_end_date),
    'importedCount', (select coalesce(sum(imported_count), 0) from public.searches
      where organization_id = p_organization_id
        and created_at >= p_start_date and created_at < p_end_date),
    -- ── NOVOS (Fase 4): métricas que antes eram agregadas no cliente sobre
    -- o array truncado de 50 leads ──
    'enrichedCount', (select count(*) from scoped
      where phone is not null or whatsapp is not null or email is not null),
    'respondedCount', (select count(*) from scoped where responded_at is not null),
    'meetingCount', (select count(*) from scoped where meeting_at is not null),
    'proposalCount', (select count(*) from scoped where proposal_at is not null),
    'discardedCount', (select count(*) from scoped where stage = 'discarded'),
    'pipelineCount', (select count(*) from scoped where stage not in ('discarded','won')),
    'pipelineValueWindowed', (select coalesce(sum(estimated_value), 0) from scoped
      where stage not in ('discarded','won')),
    'channels', jsonb_build_object(
      'whatsapp', (select count(*) from scoped where whatsapp is not null),
      'phone', (select count(*) from scoped where phone is not null),
      'instagram', (select count(*) from scoped where instagram is not null),
      'email', (select count(*) from scoped where email is not null),
      'site', (select count(*) from scoped where has_website)
    ),
    'dailySeries', (select coalesce(jsonb_agg(jsonb_build_object(
        'date', d::text, 'leads', leads, 'won', won, 'revenue', revenue
      ) order by d), '[]'::jsonb)
      from (
        select d.d,
          count(lc.id) as leads,
          count(lw.id) as won,
          coalesce(sum(lw.closed_value), 0) as revenue
        from generate_series(
          greatest(p_start_date::date, (p_end_date::date - interval '30 days')),
          p_end_date::date, '1 day'
        ) as d(d)
        left join public.leads lc
          on lc.organization_id = p_organization_id
         and lc.created_at >= d.d and lc.created_at < d.d + interval '1 day'
        left join public.leads lw
          on lw.organization_id = p_organization_id
         and lw.stage = 'won'
         and lw.closed_at >= d.d and lw.closed_at < d.d + interval '1 day'
        group by d.d
      ) s),
    -- Funnel INTEIRO (Prova de Valor) — nunca derivado de array truncado.
    'allTime', jsonb_build_object(
      'totalFound', (select count(*) from public.leads where organization_id = p_organization_id),
      'withoutWebsite', (select count(*) from public.leads
        where organization_id = p_organization_id and not has_website),
      'noReviews', (select count(*) from public.leads
        where organization_id = p_organization_id and review_count = 0),
      'lowRating', (select count(*) from public.leads
        where organization_id = p_organization_id and rating is not null and rating < 4),
      'hot', (select count(*) from public.leads
        where organization_id = p_organization_id and temperature = 'hot'),
      'contacted', (select count(*) from public.leads
        where organization_id = p_organization_id and last_interaction_at is not null),
      'responded', (select count(*) from public.leads
        where organization_id = p_organization_id and responded_at is not null),
      'meetings', (select count(*) from public.leads
        where organization_id = p_organization_id and meeting_at is not null),
      'proposals', (select count(*) from public.leads
        where organization_id = p_organization_id and proposal_at is not null),
      'won', (select count(*) from public.leads
        where organization_id = p_organization_id and stage = 'won'),
      'revenue', (select coalesce(sum(closed_value), 0) from public.leads
        where organization_id = p_organization_id and stage = 'won'),
      'cities', (select coalesce(jsonb_agg(city order by city), '[]'::jsonb)
        from (select distinct city from public.leads
              where organization_id = p_organization_id and city is not null) c)
    )
  ) into result;

  return result;
end;
$$;
