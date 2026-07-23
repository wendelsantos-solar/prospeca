-- Google-only cache (Fase 2): extend provider_search_cache TTL 7d -> 30d.
-- Google Places ToS caps caching of non-place_id fields (name, phone, rating,
-- address) at 30 days. Changes the column default only — affects new rows;
-- existing (legacy Overpass) rows keep their 7d expiry and age out naturally.
alter table public.provider_search_cache
  alter column expires_at set default (now() + interval '30 days');
