-- Apaga só o lixo de descoberta: leads de busca, ainda em 'new', nunca tocados.
delete from public.leads l
where l.source = 'search'
  and l.stage = 'new'
  and l.last_interaction_at is null
  and not exists (select 1 from public.lead_notes n where n.lead_id = l.id)
  and not exists (select 1 from public.lead_activities a where a.lead_id = l.id);

-- Zera vínculos de search_results que ficaram apontando para leads apagados.
update public.search_results sr
set imported_lead_id = null
where sr.imported_lead_id is not null
  and not exists (select 1 from public.leads l where l.id = sr.imported_lead_id);
