-- Additive, idempotent. Ensures the service_role (used by Edge Functions,
-- bypasses RLS by design) can access public objects on ANY deploy target.
-- Hosted Supabase grants these automatically; local/self-hosted resets do not
-- always, which surfaced as `42501 permission denied` in edge functions.
-- Safe to re-run: GRANT is idempotent.
grant usage on schema public to service_role;

grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Future objects created by the migration owner.
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;
alter default privileges in schema public
  grant execute on functions to service_role;
