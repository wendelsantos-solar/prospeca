-- Admin define teto de gasto mensal (US$) por org, direto do painel. Ativa o
-- guarda-corpo do execute-search (que ja le monthly_api_budget_usd): ao estourar,
-- a org para de pagar Google e serve so cache. null = ilimitado.

create or replace function public.set_org_budget(p_org uuid, p_budget numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_budget is not null and p_budget < 0 then
    raise exception 'budget invalido' using errcode = '22023';
  end if;
  update public.organizations set monthly_api_budget_usd = p_budget where id = p_org;
end;
$$;

-- get_admin_orgs: incluir o budget atual (pra exibir/editar no painel).
create or replace function public.get_admin_orgs(
  p_from timestamptz default date_trunc('month', now()),
  p_to timestamptz default now()
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into result from (
    select o.id as org_id, o.name, o.plan,
      o.monthly_api_budget_usd as budget_usd,
      (select count(*) from public.organization_members m where m.organization_id = o.id) as users,
      (select count(*) from public.searches s where s.organization_id = o.id and s.created_at >= p_from and s.created_at < p_to and s.status in ('completed','partial')) as searches,
      round(coalesce((select sum(u.quantity * case u.event_type when 'place_search_request' then 0.035 when 'place_details_request' then 0.020 when 'geocode_request' then 0.005 else 0 end)
        from public.usage_events u where u.organization_id = o.id and u.created_at >= p_from and u.created_at < p_to), 0), 2) as est_cost_usd,
      (select max(created_at) from public.searches s where s.organization_id = o.id) as last_activity
    from public.organizations o order by est_cost_usd desc, searches desc
  ) t;
  return result;
end;
$$;

revoke all on function public.set_org_budget(uuid, numeric) from public, anon;
grant execute on function public.set_org_budget(uuid, numeric) to authenticated, service_role;
