-- Supabase Storage resolves objects through SELECT before DELETE. Grant the
-- uploader access to its own private object so orphan cleanup actually removes
-- it; cross-tenant paths remain inaccessible.
drop policy if exists feedback_attachments_select_own on storage.objects;
create policy feedback_attachments_select_own
  on storage.objects for select to authenticated
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
