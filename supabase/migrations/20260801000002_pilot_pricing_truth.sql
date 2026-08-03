-- Public pricing must describe the product that can be activated today.
-- Keep future catalog entries for roadmap work, but hide them from the paid
-- pilot and disable entitlements that are not enforced end-to-end yet.
update public.billing_plans
set is_public = code in ('free', 'professional');

update public.billing_plans
set
  description = case
    when code = 'professional' then 'Piloto fundador com onboarding assistido.'
    else description
  end,
  features = features || '{
    "search_monitoring": false,
    "xlsx_export": false,
    "cadences": false,
    "automations": false,
    "advanced_analytics": false,
    "team_management": false,
    "custom_permissions": false,
    "api_access": false
  }'::jsonb
where code in ('professional', 'agency', 'team');
