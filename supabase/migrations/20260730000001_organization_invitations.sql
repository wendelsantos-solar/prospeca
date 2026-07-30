-- Radar Local — organization invitations
-- Suporte a convite de membros para organizações.

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'admin', 'member')),
  token_hash text not null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  invited_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index idx_invitations_org on public.organization_invitations (organization_id);
create index idx_invitations_email on public.organization_invitations (email);
create index idx_invitations_token on public.organization_invitations (token_hash);
create unique index uq_invitations_org_email_pending
  on public.organization_invitations (organization_id, email)
  where accepted_at is null and revoked_at is null;

-- RLS
alter table public.organization_invitations enable row level security;

-- Members of the org can see pending invitations
create policy invitations_select on public.organization_invitations for select
  using (public.is_organization_member(organization_id));

-- Owner/admin can create invitations
create policy invitations_insert on public.organization_invitations for insert
  with check (
    public.has_organization_role(organization_id, array['owner','admin'])
    and invited_by = auth.uid()
  );

-- Owner/admin can revoke invitations
create policy invitations_update on public.organization_invitations for update
  using (public.has_organization_role(organization_id, array['owner','admin']));

-- Owner/admin can delete invitations
create policy invitations_delete on public.organization_invitations for delete
  using (public.has_organization_role(organization_id, array['owner','admin']));
