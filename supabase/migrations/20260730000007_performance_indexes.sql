-- Performance: composite indexes for hot query paths.
--
-- get_search_discovery orders by score desc, distance asc and joins
-- search_results → places → searches. The existing idx_search_results_search
-- covers WHERE search_id = X, but the ORDER BY causes a sort on every call.
-- Adding (search_id, score desc) eliminates that sort.
create index if not exists idx_search_results_search_score
  on public.search_results (search_id, score desc nulls last);

-- get_search_discovery joins places via place_id; the RPC also reads
-- location (lat/lng) and primary_type (category). A covering index avoids
-- the heap fetch for places in the discovery hot path.
create index if not exists idx_places_discovery
  on public.places (id) include (
    name, primary_type, location, national_phone_number,
    website_uri, rating, user_rating_count
  );

-- execute-search upserts into search_results with ON CONFLICT
-- (search_id, place_id). The unique constraint creates an implicit index,
-- but the upsert also reads distance_meters and is_inside_radius for scoring.
-- No action needed — the unique index already serves lookups.

-- searches are listed per-org ordered by created_at (history). The existing
-- idx_searches_org_created covers this. A partial index for active searches
-- (status IN queued,searching) helps the dashboard and poll loop on the
-- recovery cron (recover_stuck_searches).
create index if not exists idx_searches_active
  on public.searches (organization_id, created_at desc)
  where status in ('queued', 'searching', 'importing', 'enriching');
