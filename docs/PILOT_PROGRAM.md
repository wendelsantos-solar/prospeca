# Programa Pilot — Radar Local

**Data:** 2026-07-30
**Status:** Configurado (plano Pilot no banco), operacionalização pendente

---

## Objetivo

Validar o Radar Local com 5-10 usuários reais antes do lançamento comercial.
Coletar feedback, medir ativação e confirmar disposição a pagar.

## Plano Pilot

| Propriedade | Valor |
|------------|-------|
| **Código** | `pilot` |
| **Preço** | R$ 0 (gratuito durante o beta) |
| **Duração padrão** | 30 dias (prorrogável) |
| **Usuários** | 1 |
| **Buscas/mês** | 60 |
| **Leads processados/mês** | 1.000 |
| **Monitores ativos** | 5 |
| **Pipelines** | 1 |
| **Templates de mensagem** | 20 |
| **Exportação** | CSV (3.000 linhas/mês) |
| **Recursos** | Busca, filtros avançados, pipeline, buscas salvas, monitoramento, analytics |
| **Suporte** | Direto (e-mail/WhatsApp do time) |

## Status do piloto (na organização)

| Campo | Descrição |
|-------|-----------|
| `pilot_status` | `invited` → `onboarding` → `active` → `completed`/`converted`/`declined`/`expired` |
| `pilot_started_at` | Quando o piloto começou a usar |
| `pilot_ends_at` | Data de expiração |
| `pilot_notes` | Observações internas |
| `pilot_source` | Origem (indicação, inbound, outbound) |

## Fluxo de convite

1. **Admin identifica** potencial piloto (indicação, inbound, etc.)
2. **Admin cria acesso piloto:**
   - Define e-mail, duração, limites
   - Sistema cria organization (se não existir) ou seleciona existente
   - Define `pilot_status = invited`
3. **Convite é enviado** por e-mail (link com token)
4. **Usuário aceita** convite → cria senha → `pilot_status = onboarding`
5. **Onboarding** guiado até primeira busca
6. **Acompanhamento:**
   - 24h: verificar se fez primeira busca
   - 7 dias: verificar engajamento
   - 15 dias: check-in pessoal
   - 30 dias: decisão (converter, prorrogar, encerrar)

## Critérios de sucesso do piloto

- [ ] Completou onboarding
- [ ] Executou pelo menos 3 buscas
- [ ] Visualizou pelo menos 10 leads
- [ ] Adicionou leads ao Pipeline
- [ ] Preparou pelo menos 1 mensagem
- [ ] Reportou valor percebido (qualitativo)
- [ ] Manifestou interesse em continuar (pago)

## Conversão

Quando o piloto está pronto para converter:

1. Admin altera `pilot_status = converted`
2. Admin define plano (Free, Solo, Profissional ou Agência)
3. Sistema atualiza `subscriptions`:
   - Se período gratuito: plano Free com trial
   - Se pagamento combinado: gerar link de checkout (futuro)

## Métricas do programa

| Métrica | Descrição |
|---------|-----------|
| Pilotos convidados | Total de convites enviados |
| Taxa de aceite | Convites aceitos / enviados |
| Tempo até primeira busca | Mediana em horas |
| Taxa de ativação | Pilotos que atingiram evento de ativação |
| Pilotos ativos (7d) | Usaram na última semana |
| Taxa de conversão | Converteram para plano / completaram |
| Tempo até conversão | Mediana em dias |
| NPS qualitativo | Feedback coletado |

## Responsabilidades

| Papel | Responsabilidade |
|-------|-----------------|
| Founder / PM | Selecionar pilotos, conduzir check-ins |
| Tech Lead | Criar acesso, monitorar erros |
| Suporte | Responder dúvidas em até 24h (dias úteis) |
| Time | Reportar bugs e feedback imediatamente |
