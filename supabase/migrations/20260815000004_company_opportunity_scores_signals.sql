-- Fase 3 — Sinais persistidos no score (spec #60).
--
-- `signals` guarda o array de evidências derivadas por packages/domain/
-- signals.ts#buildSignalEvidence: {signal, severity, evidence, confidence,
-- source, derivedAt} — os fatos observáveis que sustentam o score, com
-- severidade/evidência/confiança/origem/data. Escrito pelo score-company
-- junto do breakdown; a UI lê do persistido com fallback client-side.

alter table public.company_opportunity_scores
  add column if not exists signals jsonb;
