-- A commercial touch is only persisted after explicit user confirmation.
-- Cadence progress is denormalized on leads for cheap list/Today queries, while
-- the completed activity remains the immutable source of what happened.
alter table public.leads
  add column if not exists cadence_started_at timestamptz,
  add column if not exists cadence_step integer not null default 0
    check (cadence_step between 0 and 4),
  add column if not exists cadence_completed_at timestamptz,
  add column if not exists last_outcome text
    check (last_outcome in ('sent','answered','no_answer','meeting','proposal','won','lost')),
  add column if not exists responded_at timestamptz,
  add column if not exists meeting_at timestamptz,
  add column if not exists proposal_at timestamptz;

alter table public.lead_activities
  add column if not exists occurred_at timestamptz,
  add column if not exists outcome text
    check (outcome in ('sent','answered','no_answer','meeting','proposal','won','lost')),
  add column if not exists cadence_step_id text
    check (cadence_step_id in ('followup-1','call-1','followup-2','last-attempt'));

create index if not exists idx_leads_org_cadence
  on public.leads (organization_id, cadence_started_at, cadence_step)
  where stage = 'contacted' and cadence_completed_at is null;

create or replace function public.record_lead_contact(
  p_lead_id uuid,
  p_channel text,
  p_title text,
  p_outcome text,
  p_occurred_at timestamptz default now(),
  p_description text default null,
  p_cadence_step_id text default null
)
returns public.lead_activities
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_lead public.leads;
  v_activity public.lead_activities;
  v_step_order integer := case p_cadence_step_id
    when 'followup-1' then 1
    when 'call-1' then 2
    when 'followup-2' then 3
    when 'last-attempt' then 4
    else 0
  end;
  v_activity_type text := case p_channel
    when 'whatsapp' then 'whatsapp'
    when 'email' then 'email'
    when 'call' then 'call'
    else null
  end;
begin
  if v_activity_type is null then
    raise exception 'VALIDATION_ERROR: invalid channel';
  end if;
  if p_outcome not in ('sent','answered','no_answer','meeting','proposal','won','lost') then
    raise exception 'VALIDATION_ERROR: invalid outcome';
  end if;
  if coalesce(trim(p_title), '') = '' then
    raise exception 'VALIDATION_ERROR: title required';
  end if;

  select * into v_lead from public.leads where id = p_lead_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if not public.is_organization_member(v_lead.organization_id) then
    raise exception 'FORBIDDEN';
  end if;

  update public.leads
  set
    stage = case when stage in ('won', 'discarded') then stage else 'contacted' end,
    last_interaction_at = p_occurred_at,
    cadence_started_at = coalesce(cadence_started_at, p_occurred_at),
    cadence_step = greatest(cadence_step, v_step_order),
    cadence_completed_at = case
      when greatest(cadence_step, v_step_order) >= 4
        or p_outcome in ('answered','meeting','proposal','won') then p_occurred_at
      else cadence_completed_at
    end,
    last_outcome = p_outcome,
    responded_at = case when p_outcome = 'answered' then p_occurred_at else responded_at end,
    meeting_at = case when p_outcome = 'meeting' then p_occurred_at else meeting_at end,
    proposal_at = case when p_outcome = 'proposal' then p_occurred_at else proposal_at end
  where id = p_lead_id
  returning * into v_lead;

  insert into public.lead_activities (
    organization_id,
    lead_id,
    created_by,
    type,
    title,
    description,
    status,
    priority,
    scheduled_at,
    completed_at,
    occurred_at,
    outcome,
    cadence_step_id
  ) values (
    v_lead.organization_id,
    p_lead_id,
    auth.uid(),
    v_activity_type,
    p_title,
    p_description,
    'completed',
    'medium',
    p_occurred_at,
    p_occurred_at,
    p_occurred_at,
    p_outcome,
    p_cadence_step_id
  ) returning * into v_activity;

  return v_activity;
end;
$$;

grant execute on function public.record_lead_contact(uuid, text, text, text, timestamptz, text, text)
  to authenticated;

-- Moving a card is workflow metadata, not proof that a customer interaction
-- happened. Contacts now update last_interaction_at only through the function
-- above, after explicit confirmation.
create or replace function public.move_lead_stage(
  p_lead_id uuid,
  p_to_stage text,
  p_metadata jsonb default '{}'::jsonb
)
returns public.leads
language plpgsql
as $$
declare
  v_lead public.leads;
  v_from text;
begin
  select * into v_lead from public.leads where id = p_lead_id for update;
  if not found then
    raise exception 'LEAD_NOT_FOUND';
  end if;
  if not public.is_organization_member(v_lead.organization_id) then
    raise exception 'FORBIDDEN';
  end if;
  if p_to_stage not in ('new','qualified','contacted','won','discarded') then
    raise exception 'VALIDATION_ERROR: invalid stage';
  end if;
  if p_to_stage = 'won' and (p_metadata ->> 'closed_value') is null then
    raise exception 'VALIDATION_ERROR: closed_value required for won';
  end if;
  if p_to_stage = 'discarded' and coalesce(p_metadata ->> 'discard_reason', '') = '' then
    raise exception 'VALIDATION_ERROR: discard_reason required for discarded';
  end if;

  v_from := v_lead.stage;

  update public.leads set
    stage = p_to_stage,
    closed_value = case when p_to_stage = 'won'
      then (p_metadata ->> 'closed_value')::numeric else closed_value end,
    closed_service = case when p_to_stage = 'won'
      then coalesce(p_metadata ->> 'closed_service', closed_service) else closed_service end,
    closed_at = case when p_to_stage = 'won'
      then coalesce((p_metadata ->> 'closed_at')::timestamptz, now()) else closed_at end,
    discard_reason = case when p_to_stage = 'discarded'
      then p_metadata ->> 'discard_reason' else discard_reason end,
    discarded_at = case when p_to_stage = 'discarded' then now() else discarded_at end
  where id = p_lead_id
  returning * into v_lead;

  insert into public.lead_stage_history (
    organization_id, lead_id, from_stage, to_stage, changed_by, metadata
  ) values (
    v_lead.organization_id, p_lead_id, v_from, p_to_stage, auth.uid(), p_metadata
  );

  return v_lead;
end;
$$;
