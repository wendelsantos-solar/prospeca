-- Force refresh (Fase 4): the "Atualizar" button re-fetches from Google and
-- overwrites the cache. last_forced_at marks the last forced fetch per cache
-- key so a per-search cooldown can block accidental cost loops (D7).
alter table public.provider_search_cache
  add column if not exists last_forced_at timestamptz;
