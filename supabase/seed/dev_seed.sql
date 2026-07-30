-- Development seed — NEVER run in production.
-- Requires an existing auth user; pass its id via psql variable:
--   psql ... -v user_id="'<uuid>'" -f dev_seed.sql
-- All records are flagged via source='demo_seed' for easy cleanup.

do $$
declare
  v_user uuid := current_setting('vars.user_id', true)::uuid;
  v_org uuid;
  v_lead uuid;
begin
  if v_user is null then
    raise exception 'Set vars.user_id first: SET vars.user_id = ''<auth user uuid>'';';
  end if;

  select organization_id into v_org
  from public.organization_members where user_id = v_user limit 1;
  if v_org is null then
    raise exception 'User has no organization (signup trigger creates one).';
  end if;

  insert into public.leads (
    organization_id, created_by, company_name, category, address, neighborhood,
    city, state, latitude, longitude, phone, phone_e164, whatsapp, whatsapp_status,
    has_website, rating, review_count, score, temperature, stage, source
  ) values
    (v_org, v_user, 'Padaria Estrela do Bairro [DEMO]', 'padaria', 'Rua das Flores, 120', 'Centro',
     'São Paulo', 'SP', -23.5510, -46.6340, '(11) 98765-4321', '+5511987654321', '+5511987654321', 'possible',
     false, 4.6, 210, 80, 'hot', 'new', 'demo_seed'),
    (v_org, v_user, 'Clínica Sorriso Feliz [DEMO]', 'dentista', 'Av. Paulista, 900', 'Bela Vista',
     'São Paulo', 'SP', -23.5620, -46.6544, '(11) 3255-1122', '+551132551122', null, 'unknown',
     true, 4.8, 340, 45, 'warm', 'qualified', 'demo_seed'),
    (v_org, v_user, 'Oficina do Zé [DEMO]', 'oficina mecânica', 'Rua Augusta, 45', 'Consolação',
     'São Paulo', 'SP', -23.5530, -46.6480, '(11) 99911-2233', '+5511999112233', '+5511999112233', 'possible',
     false, 4.1, 58, 75, 'hot', 'contacted', 'demo_seed'),
    (v_org, v_user, 'Salão Bela Vida [DEMO]', 'salão de beleza', 'Rua Oscar Freire, 300', 'Jardins',
     'São Paulo', 'SP', -23.5619, -46.6698, '(11) 97700-8899', '+5511977008899', '+5511977008899', 'possible',
     false, 4.9, 120, 85, 'hot', 'won', 'demo_seed');

  update public.leads
    set closed_value = 1800, closed_service = 'Site institucional', closed_at = now() - interval '3 days'
    where organization_id = v_org and stage = 'won' and source = 'demo_seed';

  select id into v_lead from public.leads
    where organization_id = v_org and source = 'demo_seed' limit 1;

  insert into public.lead_notes (organization_id, lead_id, created_by, content)
  values (v_org, v_lead, v_user, 'Dono muito receptivo. Retornar na segunda. [DEMO]');

  insert into public.lead_activities (organization_id, lead_id, created_by, type, title, scheduled_at)
  values (v_org, v_lead, v_user, 'follow_up', 'Retornar contato [DEMO]', now() + interval '2 days');

  insert into public.lead_stage_history (organization_id, lead_id, from_stage, to_stage, changed_by)
  select organization_id, id, 'new', stage, v_user
  from public.leads where organization_id = v_org and source = 'demo_seed' and stage <> 'new';

  -- ── Usage counters (entitlements) ───────────────────────────────
  -- Simula uso do período corrente para testar o painel de entitlements.
  insert into public.usage_counters (organization_id, metric, period_start, period_end, quantity)
  values
    (v_org, 'searches',          date_trunc('month', now())::date, (date_trunc('month', now()) + interval '1 month')::date, 8),
    (v_org, 'processed_leads',   date_trunc('month', now())::date, (date_trunc('month', now()) + interval '1 month')::date, 34),
    (v_org, 'exports',           date_trunc('month', now())::date, (date_trunc('month', now()) + interval '1 month')::date, 1)
  on conflict (organization_id, metric, period_start) do update set quantity = excluded.quantity, updated_at = now();

  -- ── Feedback demo ───────────────────────────────────────────────
  insert into public.feedback (organization_id, user_id, type, category, message, sentiment, goal, status, created_at)
  values
    (v_org, v_user, 'feedback', 'search', 'O search de padaria em SP retornou resultados muito bons!', 'happy', 'Encontrar leads de padaria', 'open', now() - interval '1 day'),
    (v_org, v_user, 'bug', 'search', 'Não consegui filtrar por bairro, a busca parece ignorar o filtro.', 'frustrated', 'Filtrar leads por região específica', 'open', now() - interval '2 hours');

  raise notice 'Demo seed done for org %', v_org;
end $$;
