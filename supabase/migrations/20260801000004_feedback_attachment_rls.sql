-- Feedback screenshots are written directly by the authenticated browser.
-- Keep the bucket private and scope every object path as:
--   <organization_id>/<user_id>/<random filename>
-- The feedback Edge Function later creates a short-lived signed URL for the
-- internal notification; customers never receive a public object URL.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'feedback-attachments',
  'feedback-attachments',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.feedback
  add column if not exists screenshot_path text
    check (screenshot_path is null or char_length(screenshot_path) <= 500);

drop policy if exists feedback_attachments_insert on storage.objects;
create policy feedback_attachments_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'feedback-attachments'
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (
      select 1
      from public.organization_members membership
      where membership.user_id = auth.uid()
        and membership.organization_id::text = (storage.foldername(name))[1]
    )
  );

-- Allows the browser to clean up its own orphan if feedback submission fails.
-- The uploader can read/delete only its own object. Internal notifications use
-- a short-lived signed URL instead of a permanent public URL.
drop policy if exists feedback_attachments_delete on storage.objects;
create policy feedback_attachments_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'feedback-attachments'
    and owner_id = auth.uid()::text
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (
      select 1
      from public.organization_members membership
      where membership.user_id = auth.uid()
        and membership.organization_id::text = (storage.foldername(name))[1]
    )
  );
