# Product Activation Model — Radar Local

**Data:** 2026-07-30
**Versão:** 1.0

---

## Definição de ativação

**Usuário está ATIVADO quando:**

```text
executou uma busca real
+
abriu pelo menos uma oportunidade (detalhes do lead)
+
adicionou pelo menos um lead ao Pipeline
```

Este é o momento "Aha!" — o usuário viu valor real: descobriu empresas,
explorou uma oportunidade e organizou para ação.

---

## Evento de ativação técnico

```json
{
  "event": "user_activated",
  "user_id": "...",
  "organization_id": "...",
  "timestamp": "...",
  "properties": {
    "first_search_at": "...",
    "first_lead_viewed_at": "...",
    "first_lead_added_to_pipeline_at": "...",
    "time_to_activate_seconds": 300
  }
}
```

---

## Jornada do usuário

### Fase 1: Aquisição → Cadastro

- Landing page → Preços → Cadastro
- Evento: `account_created`
- Tempo alvo: < 2 minutos

### Fase 2: Cadastro → Primeira busca

- Preencher perfil comercial (o que vende, região)
- Escolher nicho + localização
- Executar primeira busca
- Evento: `first_search_completed`
- Tempo alvo: < 5 minutos após cadastro

### Fase 3: Primeira busca → Exploração

- Ver resultados no mapa/lista
- Abrir detalhes de uma empresa
- Ver score, canais de contato
- Evento: `lead_viewed`
- Tempo alvo: < 2 minutos após busca

### Fase 4: Exploração → Pipeline

- Selecionar lead promissor
- Adicionar ao Pipeline
- Evento: `lead_added_to_pipeline`
- Tempo alvo: < 3 minutos após explorar

### Fase 5: Ativação → Engajamento

- Pipeline → Preparar mensagem
- Agendar follow-up
- Marcar como contactado/ganho
- Eventos: `message_prepared`, `activity_created`

---

## Eventos de produto

### Eventos de aquisição

| Evento                | Trigger            | Propriedades          |
| --------------------- | ------------------ | --------------------- |
| `landing_page_viewed` | Visitou `/`        | source, utm\_\*       |
| `pricing_page_viewed` | Visitou `/precos`  | -                     |
| `signup_started`      | Clicou "Cadastrar" | source                |
| `account_created`     | Signup concluído   | plan, organization_id |
| `email_confirmed`     | Confirmou e-mail   | -                     |

### Eventos de onboarding

| Evento                         | Trigger                | Propriedades             |
| ------------------------------ | ---------------------- | ------------------------ |
| `onboarding_started`           | Iniciou fluxo guiado   | step                     |
| `business_profile_completed`   | Preencheu perfil       | what_sells, region       |
| `first_search_started`         | Iniciou primeira busca | niche, location          |
| `first_search_completed`       | Busca concluída        | found_count, duration_ms |
| `first_lead_viewed`            | Abriu detalhes         | lead_score               |
| `first_lead_added_to_pipeline` | Adicionou ao Pipeline  | stage                    |
| `onboarding_completed`         | Fluxo concluído        | total_time_ms            |
| `onboarding_skipped`           | Pulou onboarding       | step_skipped             |

### Eventos de engajamento

| Evento                   | Trigger                  | Propriedades         |
| ------------------------ | ------------------------ | -------------------- |
| `search_completed`       | Qualquer busca concluída | found_count, cached  |
| `lead_viewed`            | Abriu lead               | score, temperature   |
| `lead_added_to_pipeline` | Adicionou lead           | stage                |
| `lead_stage_changed`     | Moveu lead               | from_stage, to_stage |
| `message_prepared`       | Preparou mensagem        | channel              |
| `activity_created`       | Criou atividade          | type                 |
| `activity_completed`     | Completou atividade      | type                 |
| `export_completed`       | Exportou dados           | format, row_count    |

### Eventos de retenção e monetização

| Evento                 | Trigger          | Propriedades       |
| ---------------------- | ---------------- | ------------------ |
| `user_returned`        | Login após 24h+  | days_since_last    |
| `usage_limit_reached`  | Atingiu limite   | metric, limit      |
| `plan_upgrade_started` | Iniciou upgrade  | from_plan, to_plan |
| `subscription_created` | Assinatura ativa | plan, value        |
| `feedback_submitted`   | Enviou feedback  | type, category     |

---

## Métricas do funil

```
Visitantes → Cadastros → Primeira busca → Lead visualizado → Lead no Pipeline → Ativado
   100%    →    X%     →       Y%        →       Z%         →        W%         →    A%
```

### Métricas alvo para beta

| Métrica                             | Alvo         |
| ----------------------------------- | ------------ |
| Visitante → Cadastro                | > 5%         |
| Cadastro → Primeira busca           | > 70%        |
| Primeira busca → Lead visualizado   | > 80%        |
| Lead visualizado → Lead no Pipeline | > 50%        |
| Tempo até ativação (mediana)        | < 15 minutos |
| Ativação na primeira sessão         | > 40%        |
| Retorno em 7 dias                   | > 30%        |

---

## Acompanhamento do beta

### Por piloto

- Status do onboarding (etapa atual)
- Tempo até primeira busca
- Buscas realizadas
- Leads visualizados
- Leads no Pipeline
- Atividades criadas
- Mensagens preparadas
- Última atividade
- Dias ativos nos últimos 7/30 dias

### Agregado

- Total de pilotos ativos
- Taxa de ativação
- Tempo mediano até ativação
- Buscas por organização por semana
- Leads adicionados por organização por semana
- Oportunidades qualificadas trabalhadas por semana

---

## Implementação

Os eventos devem ser registrados via `analytics.ts` e persistidos no banco
(tabela `usage_events` com `metric` para métricas de produto, separadas das
métricas de custo de API que usam `event_type`).

Ver `lib/analytics.ts` para a implementação atual e expandir conforme
necessário.
