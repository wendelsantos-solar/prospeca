-- Feedback enhancements: sentiment, goal, email, contact consent

-- New columns on feedback table
alter table public.feedback
  add column if not exists sentiment text
    check (sentiment is null or sentiment in ('frustrated', 'neutral', 'happy')),
  add column if not exists goal text
    check (goal is null or char_length(goal) <= 200),
  add column if not exists email text
    check (email is null or char_length(email) <= 320),
  add column if not exists can_contact boolean
    default false,
  add column if not exists recent_actions jsonb;

-- Storage bucket for feedback screenshots
-- Note: bucket creation is handled via Supabase dashboard or config.toml.
-- For local dev, add to supabase/config.toml:
--   [storage.buckets.feedback-attachments]
--   public = false
--   file_size_limit = "10MB"
--   allowed_mime_types = ["image/png", "image/jpeg", "image/webp", "image/gif"]

-- If running via supabase CLI with config.toml, the bucket is created automatically.
-- If needed manually:
--   select storage.create_bucket('feedback-attachments', false, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'], 10485760, false);

-- RLS policy for feedback-attachments bucket (only org members can read their own)
-- Note: this is a placeholder; actual storage RLS is configured via Supabase dashboard.
-- The policy below should be applied to the storage.objects table for the feedback-attachments bucket:
--
-- create policy "feedback_attachments_insert" on storage.objects for insert
--   with check (
--     bucket_id = 'feedback-attachments'
--     and auth.role() = 'authenticated'
--   );
--
-- create policy "feedback_attachments_select" on storage.objects for select
--   using (
--     bucket_id = 'feedback-attachments'
--     and auth.role() = 'authenticated'
--   );
