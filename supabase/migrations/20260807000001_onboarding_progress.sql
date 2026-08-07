-- Onboarding wizard progress was only ever persisted to the browser's
-- localStorage — it doesn't survive a different browser/device or cleared
-- storage, which reads as "the onboarding keeps reappearing" to a real pilot
-- user switching machines. Move it to the user's own profile row.
alter table public.profiles
  add column if not exists onboarding_progress jsonb;

comment on column public.profiles.onboarding_progress is
  'Shape: {step: number, completed: boolean, skippedSteps: string[]}. Null = never started.';
