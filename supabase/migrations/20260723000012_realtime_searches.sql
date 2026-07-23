-- UX: empurra o progresso da busca via Supabase Realtime em vez de polling.
-- Numa busca com cache hit o execute-search termina em ~300ms; sem Realtime o
-- front só percebe no próximo poll (piso de ~1-2s). Adicionar `searches` à
-- publicação realtime deixa o "completed" chegar na hora. RLS continua valendo:
-- o assinante só recebe as linhas que já pode ler (sua própria org).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'searches'
  ) then
    alter publication supabase_realtime add table public.searches;
  end if;
end $$;
