-- Additive, idempotent. Restores the role grants that hosted Supabase applies
-- automatically but local/self-hosted resets do not — which surfaced as
-- `42501 permission denied` (service_role) and empty RLS reads (authenticated).
-- RLS still governs WHICH rows each role sees; these grants only allow the role
-- to touch the tables at all. Safe to re-run.
grant usage on schema public to anon, authenticated, service_role;

-- authenticated + anon: table access gated by RLS policies.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant usage, select on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;

-- service_role: full access, bypasses RLS by design.
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Future objects created by the migration owner get the same grants.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema public grant select on tables to anon;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;
