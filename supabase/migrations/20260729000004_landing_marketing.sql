-- Landing page comercial — Fase 1: form de vendas, intenção de plano no
-- cadastro, e config (banco, não hardcode) da oferta fundadores.

create table public.sales_contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  company text,
  team_size text,
  sells_what text,
  prospecting_volume text,
  whatsapp text,
  message text not null,
  source text,
  utm jsonb,
  status text not null default 'new' check (status in ('new','contacted','qualified','disqualified')),
  created_at timestamptz not null default now()
);
create index idx_sales_contacts_created on public.sales_contacts (created_at desc);
create index idx_sales_contacts_email_recent on public.sales_contacts (email, created_at desc);

alter table public.sales_contacts enable row level security;
-- Sem policy de select/insert pra authenticated/anon — só a edge function
-- submit-sales-contact (service role) escreve, e só staff via SQL direto lê
-- por enquanto. Nenhum acesso de cliente é necessário nesta fase.

-- Intenção de plano capturada no cadastro (não altera a subscription real
-- — toda org nasce em 'free' de verdade via handle_new_user(), isso é só
-- registro pra mostrar o aviso pós-cadastro e pra vendas consultarem).
alter table public.organizations add column intended_plan text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  free_plan_id uuid;
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));

  insert into public.organizations (name, owner_user_id, intended_plan)
  values (
    coalesce(new.raw_user_meta_data ->> 'company_name', 'Minha organização'),
    new.id,
    new.raw_user_meta_data ->> 'intended_plan'
  )
  returning id into org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (org_id, new.id, 'owner');

  select id into free_plan_id from public.billing_plans where code = 'free';
  insert into public.subscriptions (organization_id, plan_id, status)
  values (org_id, free_plan_id, 'free');

  return new;
end;
$$;

-- Oferta fundadores: schema pronto, desligada. Não inventamos "vagas
-- restantes" — a seção na landing só renderiza quando is_active = true e
-- alguém tiver decidido os números reais (update manual desta linha).
create table public.founder_offer (
  id uuid primary key default gen_random_uuid(),
  is_active boolean not null default false,
  seats_total integer,
  seats_claimed integer not null default 0,
  price_cents integer,
  plan_id uuid references public.billing_plans(id),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_founder_offer_updated before update on public.founder_offer
  for each row execute function public.set_updated_at();
alter table public.founder_offer enable row level security;
-- Público pode ler (a landing precisa saber se está ativa) — nunca escreve.
create policy founder_offer_select on public.founder_offer for select using (true);

insert into public.founder_offer (is_active, plan_id)
select false, id from public.billing_plans where code = 'professional';
