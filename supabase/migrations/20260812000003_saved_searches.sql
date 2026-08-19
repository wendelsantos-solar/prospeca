-- Saved searches: a search becomes a reusable "missão de prospecção" the user
-- names and revisits. Reuses the existing `searches` row (a search IS the saved
-- entity — no parallel table); `is_saved`/`saved_name` mark and label it.
-- Reopening a saved search reads its existing `search_results` (no paid call).

alter table public.searches
  add column if not exists is_saved boolean not null default false,
  add column if not exists saved_name text;

create index if not exists idx_searches_org_saved
  on public.searches (organization_id, is_saved, created_at desc);

-- Saved searches + per-search opportunity stats in one round-trip (avoids N+1).
-- Stats are derived from the already-persisted search_results ⋈ places, so they
-- are honest aggregates of real data, not re-computed statistics.
create or replace function public.get_saved_searches(p_organization_id uuid)
returns table (
  search_id uuid,
  query text,
  category text,
  location_label text,
  radius_meters integer,
  presence_filter text,
  status text,
  found_count integer,
  imported_count integer,
  created_at timestamptz,
  saved_name text,
  latitude double precision,
  longitude double precision,
  total_results integer,
  hot_count integer,
  avg_score integer,
  without_website integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.query,
    s.category,
    s.location_label,
    s.radius_meters,
    s.presence_filter,
    s.status,
    s.found_count,
    s.imported_count,
    s.created_at,
    s.saved_name,
    st_y(s.center::geometry) as latitude,
    st_x(s.center::geometry) as longitude,
    count(sr.id) as total_results,
    count(*) filter (where sr.temperature = 'hot') as hot_count,
    coalesce(round(avg(sr.score)), 0)::integer as avg_score,
    count(*) filter (where p.website_uri is null or p.website_uri = '') as without_website
  from public.searches s
  left join public.search_results sr on sr.search_id = s.id
  left join public.places p on p.id = sr.place_id
  where s.organization_id = p_organization_id
    and s.is_saved
  group by s.id
  order by s.created_at desc;
$$;

revoke all on function public.get_saved_searches(uuid) from public, anon;
grant execute on function public.get_saved_searches(uuid) to authenticated;
