-- V4 — Decisores (QSA) — quadro de sócios e administradores da BrasilAPI.
--
-- ADITIVO: coluna qsa jsonb em places recebe o QSA respondido pelo
-- lookup-cnpj (provider business_registry já integrado, gratuito). Nunca
-- sobrescreve dado do Google; a edge function só grava quando o campo vem na
-- resposta (qsa ausente não anula um valor existente).

alter table public.places
  add column if not exists qsa jsonb;
