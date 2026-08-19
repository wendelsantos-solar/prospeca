-- Fase 3 — Admin jobs observability (spec #17). Platform-admin RPCs over the
-- jobs table, security-definer + is_platform_admin() gate — same pattern as
-- the other get_admin_* RPCs in 20260724000005_platform_admin.sql.

create or replace function public.get_admin_job_counts()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select jsonb_build_object(
    'total', count(*),
    'queued', count(*) filter (where status = 'queued'),
    'processing', count(*) filter (where status = 'processing'),
    'completed', count(*) filter (where status = 'completed'),
    'failed', count(*) filter (where status = 'failed'),
    'deadLetter', count(*) filter (where status = 'failed' and attempt >= 3)
  ) into result from public.jobs;
  return result;
end;
$$;

create or replace function public.get_admin_jobs(
  p_limit integer default 50,
  p_status text default null
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(row_to_json(t) order by t.created_at desc), '[]'::jsonb) into result from (
    select
      j.id,
      j.type,
      j.status,
      j.attempt,
      j.priority,
      j.error,
      j.started_at,
      j.finished_at,
      j.created_at,
      o.name as organization_name,
      p.name as place_name
    from public.jobs j
    left join public.organizations o on o.id = j.organization_id
    left join public.places p on p.id = j.place_id
    where (p_status is null or j.status = p_status)
    limit p_limit
  ) t;
  return result;
end;
$$;

revoke all on function public.get_admin_job_counts() from public, anon;
revoke all on function public.get_admin_jobs(integer, text) from public, anon;
grant execute on function public.get_admin_job_counts() to authenticated, service_role;
grant execute on function public.get_admin_jobs(integer, text) to authenticated, service_role;
