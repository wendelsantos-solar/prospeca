# Paid Launch Readiness Checklist — Radar Local

**Data:** 2026-07-30
**Status:** NÃO APLICÁVEL (beta privado gratuito primeiro)

Este checklist será usado quando o beta privado estiver concluído e o produto
estiver pronto para cobrança.

---

## Gate 1: Billing

| #   | Item                                             | Status | Evidência |
| --- | ------------------------------------------------ | ------ | --------- |
| 1   | Stripe conectado (produtos, preços)              | ❌     |           |
| 2   | Webhooks de billing configurados                 | ❌     |           |
| 3   | Webhooks processados com idempotência            | ❌     |           |
| 4   | Upgrade funcionando (Free → Solo → Profissional) | ❌     |           |
| 5   | Downgrade funcionando (próximo ciclo)            | ❌     |           |
| 6   | Cancelamento funcionando                         | ❌     |           |
| 7   | Falha de pagamento tratada (retry, grace period) | ❌     |           |
| 8   | PIX e cartão de crédito funcionando (Brasil)     | ❌     |           |

---

## Gate 2: Produto

| #   | Item                                           | Status | Evidência       |
| --- | ---------------------------------------------- | ------ | --------------- |
| 9   | Consumo visível ao usuário (dashboard de uso)  | ❌     |                 |
| 10  | Limites de plano aplicados                     | ⚠️     | Fundação pronta |
| 11  | Upgrade contextual (quando atinge limite)      | ❌     |                 |
| 12  | Faturas disponíveis (Stripe Customer Portal)   | ❌     |                 |
| 13  | E-mails de cobrança (fatura, falha, renovação) | ❌     |                 |

---

## Gate 3: Legal e comercial

| #   | Item                               | Status | Evidência                  |
| --- | ---------------------------------- | ------ | -------------------------- |
| 14  | Termos de Uso comerciais revisados | ❌     |                            |
| 15  | Política de reembolso definida     | ❌     |                            |
| 16  | Processo de reembolso implementado | ❌     |                            |
| 17  | CNPJ e notas fiscais configurados  | ❌     |                            |
| 18  | Preços públicos validados          | ⚠️     | Preços definidos no código |

---

## Gate 4: Suporte e operação

| #   | Item                                       | Status | Evidência |
| --- | ------------------------------------------ | ------ | --------- |
| 19  | SLA de suporte definido                    | ❌     |           |
| 20  | Canal de suporte prioritário para pagantes | ❌     |           |
| 21  | Processo de cancelamento/reativação        | ❌     |           |
| 22  | Métricas de conversão (trial → pago)       | ❌     |           |
| 23  | Métricas de churn                          | ❌     |           |

---

## Resumo

**NÃO PRONTO PARA COBRANÇA** — 0/23 itens completos.

Billing é fase posterior ao beta privado. Ver `BILLING_ARCHITECTURE.md` para
o roadmap de implementação.
