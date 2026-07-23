-- Score por-resultado (depende da distância, que é por-busca).
alter table public.search_results
  add column if not exists score integer,
  add column if not exists temperature text
    check (temperature in ('hot','warm','cold')),
  add column if not exists score_breakdown jsonb;
