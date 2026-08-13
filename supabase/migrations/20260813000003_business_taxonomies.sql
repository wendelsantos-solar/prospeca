-- Fase 2 — Business taxonomy (spec #9–10): central, data-driven category table.
--
-- Global reference data (shared across tenants, not org-scoped): any
-- authenticated user can read; only the service role / platform admins write.
-- Seed mirrors packages/domain/src/taxonomy-data.ts (the code seed stays the
-- canonical source until a business-registry provider fills CNAE codes).
-- Empty `cnae_codes` rows are pending a registry source (spec #28: never invent).

create table public.business_taxonomies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  aliases jsonb not null default '[]',
  places_types jsonb not null default '[]',
  cnae_codes jsonb not null default '[]',
  keywords jsonb not null default '[]',
  parent_id uuid references public.business_taxonomies(id) on delete set null,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_business_taxonomies_updated before update on public.business_taxonomies
  for each row execute function public.set_updated_at();

alter table public.business_taxonomies enable row level security;
create policy business_taxonomies_read on public.business_taxonomies
  for select using (true);

insert into public.business_taxonomies (name, slug, aliases, places_types, cnae_codes, keywords) values
  ('Barbearia', 'barbearia',
   '["barbearia","barber shop","salão masculino","salao masculino","barbeiro"]',
   '["hair_care","beauty_salon"]', '["9602-5/01"]', '["barbearia","barber"]'),
  ('Salão de beleza', 'salao-de-beleza',
   '["salão de beleza","salao de beleza","salão","cabeleireiro","cabeleireira","manicure","esmalteria"]',
   '["beauty_salon","hair_care"]', '["9602-5/01"]', '["salão","beleza","estética"]'),
  ('Restaurante', 'restaurante',
   '["restaurante","restaurant","restaurantes"]',
   '["restaurant"]', '["5611-2/01"]', '["restaurante","cozinha","gastronomia"]'),
  ('Pizzaria', 'pizzaria',
   '["pizzaria","pizza"]',
   '["restaurant","meal_delivery","meal_takeaway"]', '["5611-2/01"]', '["pizza","pizzaria"]'),
  ('Lanchonete', 'lanchonete',
   '["lanchonete","hamburgueria","burger","açaí","acai","delivery"]',
   '["restaurant","meal_delivery","meal_takeaway"]', '["5611-2/03"]', '["lanchonete","burger","açaí"]'),
  ('Academia', 'academia',
   '["academia","gym","crossfit","estúdio de treino","studio de treino"]',
   '["gym","fitness_center"]', '["9313-1/00"]', '["academia","fitness","crossfit"]'),
  ('Clínica odontológica', 'clinica-odontologica',
   '["clínica odontológica","clinica odontologica","dentista","odontologia"]',
   '["dentist"]', '["8630-5/03"]', '["odontologia","dentista","sorriso"]'),
  ('Clínica médica', 'clinica-medica',
   '["clínica médica","clinica medica","médico","medico","consultório médico","consultorio medico"]',
   '["doctor","hospital"]', '[]', '["medicina","saúde","clínica"]'),
  ('Pet shop', 'pet-shop',
   '["pet shop","petshop","pet","veterinária","veterinaria","banho e tosa"]',
   '["pet_store","veterinary_care"]', '[]', '["pet","animais","veterinária"]'),
  ('Escritório de advocacia', 'escritorio-de-advocacia',
   '["advocacia","advogado","advogada","escritório de advocacia","escritorio de advocacia"]',
   '["lawyer"]', '["6911-7/01"]', '["advocacia","jurídico","advogado"]'),
  ('Contabilidade', 'contabilidade',
   '["contabilidade","contador","escritório de contabilidade","escritorio de contabilidade"]',
   '["accounting"]', '["6920-6/01"]', '["contabilidade","contábil","contador"]'),
  ('Farmácia', 'farmacia',
   '["farmácia","farmacia","drogaria"]',
   '["pharmacy","drugstore"]', '["4771-7/01"]', '["farmácia","drogaria"]');

-- Parent links (pizzaria / lanchonete → restaurante).
update public.business_taxonomies set parent_id = (select id from public.business_taxonomies where slug = 'restaurante')
  where slug in ('pizzaria', 'lanchonete');
