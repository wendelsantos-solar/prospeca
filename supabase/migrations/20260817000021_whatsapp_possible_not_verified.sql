-- FASE 6 — WHATSAPP: 'verified' passa a significar validação REAL.
--
-- Até aqui, um número RASPADO do site da empresa era gravado como
-- whatsapp_status='verified' (enrich-company) e o número do próprio place
-- também (import-search-results). Ninguém nunca confirmou que existe conta de
-- WhatsApp ativa nesses números — é inferência apresentada como fato. O efeito
-- prático é o pior possível para o produto: o vendedor confia no rótulo, manda
-- a mensagem, e ela não chega.
--
-- O código já foi corrigido para gravar 'possible'. Esta migration corrige o
-- DADO HISTÓRICO gravado sob a semântica antiga.
--
-- CRITÉRIO DE SEGURANÇA: rebaixa apenas 'verified' -> 'possible'. Não toca em
-- 'invalid' (sinal negativo, custou algo para ser obtido), nem em 'unknown', e
-- não altera o número em si. Como NENHUM caminho de validação externa existe
-- ainda (WHATSAPP_VALIDATION não tem provider), todo 'verified' presente no
-- banco veio necessariamente de scrape/inferência — não há verificação legítima
-- a preservar. Se um provider for integrado depois, ele volta a gravar
-- 'verified' com lastro.
update public.places
   set whatsapp_status = 'possible'
 where whatsapp_status = 'verified';

update public.leads
   set whatsapp_status = 'possible'
 where whatsapp_status = 'verified';

comment on column public.places.whatsapp_status is
  'unknown | possible | verified | invalid. ''possible'' = candidato (raspado do site '
  'ou telefone móvel inferido). ''verified'' EXIGE confirmação por provider externo '
  '(job WHATSAPP_VALIDATION) — nunca marque scrape como verificado.';
