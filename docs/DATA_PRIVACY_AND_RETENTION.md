# Data Privacy & Retention — Radar Local

**Data:** 2026-07-30
**Status:** Em conformidade parcial. Termos legais pendentes.

---

## Dados armazenados

### Dados de usuário (personal data)

| Dado          | Tabela                | Propósito                 | Base legal               |
| ------------- | --------------------- | ------------------------- | ------------------------ |
| Nome completo | `profiles.full_name`  | Identificação no produto  | Consentimento (cadastro) |
| E-mail        | `auth.users.email`    | Autenticação, comunicação | Execução de contrato     |
| Senha (hash)  | `auth.users`          | Autenticação              | Execução de contrato     |
| Avatar        | `profiles.avatar_url` | Personalização            | Consentimento            |
| Telefone      | `profiles.phone`      | Suporte                   | Consentimento            |

### Dados de terceiros (empresas prospectadas)

| Dado            | Tabela                                        | Fonte         | Retenção                       |
| --------------- | --------------------------------------------- | ------------- | ------------------------------ |
| Nome da empresa | `places.name`, `leads.company_name`           | Google Places | Até deleção                    |
| Endereço        | `places.formatted_address`, `leads.address`   | Google Places | Até deleção                    |
| Telefone        | `places.national_phone_number`, `leads.phone` | Google Places | Até deleção ou suppression     |
| Website         | `places.website_uri`, `leads.website`         | Google Places | Até deleção                    |
| E-mail          | Extraído do website da empresa                | Enricher      | 90 dias (stale) ou suppression |
| Instagram       | Extraído do website da empresa                | Enricher      | 90 dias (stale) ou suppression |
| WhatsApp        | Extraído do website da empresa                | Enricher      | 90 dias (stale) ou suppression |
| Avaliações      | `places.rating`, `places.user_rating_count`   | Google Places | Até deleção                    |

### Dados operacionais

| Dado               | Retenção                                  |
| ------------------ | ----------------------------------------- |
| `usage_events`     | Indefinido (agregado em `usage_counters`) |
| `audit_logs`       | Indefinido (propósito de auditoria)       |
| `billing_events`   | Indefinido (propósito fiscal)             |
| `idempotency_keys` | 24 horas                                  |
| `geocode_cache`    | 30 dias                                   |
| `exports`          | 30 dias (expira)                          |

---

## Políticas de retenção

### Dados de descoberta (PII de terceiros)

- **PII de places não convertidos em lead:** Purgado após 90 dias via
  `purge_stale_discovery_pii()` (pg_cron, diário 03:00 UTC).
- **PII de leads:** Mantido até que o lead seja deletado ou o contato seja
  suprimido via opt-out.
- **Opt-out (suppression):** Contatos suprimidos via `suppression_list` são
  bloqueados em todas as operações de contato.

### Dados de conta

- **Exclusão de conta:** `delete-account-data` edge function remove a
  organização e todos os dados associados em cascata (LGPD art. 18).
- **Organização arquivada:** Dados mantidos por 30 dias após arquivamento,
  depois deletados (a implementar).

---

## Direitos do titular (LGPD)

| Direito                           | Como exercer                               |
| --------------------------------- | ------------------------------------------ |
| Confirmação e acesso              | Dashboard de configurações (a implementar) |
| Correção                          | Editar perfil                              |
| Exclusão                          | `delete-account-data` via configurações    |
| Oposição (opt-out)                | Botão "Não contatar" no lead               |
| Portabilidade                     | Export CSV (implementado)                  |
| Informação sobre compartilhamento | Política de Privacidade                    |

---

## Compartilhamento de dados

### Com terceiros

| Terceiro             | Dados compartilhados        | Propósito         |
| -------------------- | --------------------------- | ----------------- |
| Google Places API    | Query de busca, localização | Busca de empresas |
| Google Geocoding API | Endereço textual            | Geocodificação    |
| Supabase             | Todos (hospedagem)          | Infraestrutura    |
| Stripe (futuro)      | E-mail, assinatura          | Cobrança          |

### Entre tenants

**Nenhum.** Dados são isolados por `organization_id` via RLS.

---

## Segurança dos dados

- **Em trânsito:** TLS (HTTPS)
- **Em repouso:** Criptografia gerenciada pelo Supabase/PostgreSQL
- **Backups:** Criptografados (Supabase managed)
- **Logs:** Sem PII ou secrets

---

## O que falta

1. **Termos de Uso** — Documento legal de aceite obrigatório no cadastro
2. **Política de Privacidade** — Documento legal descrevendo tratamento de dados
3. **Checkbox ToS/PP no cadastro** — Implementação técnica
4. **Dashboard de privacidade** — Usuário visualiza e exporta seus dados
5. **Retenção de organização arquivada** — Purga após 30 dias
6. **Registro de consentimento** — Auditoria de quando o usuário aceitou os termos
7. **Encarregado de dados (DPO)** — Contato para questões de privacidade

---

## Aviso legal

Esta documentação descreve aspectos técnicos do tratamento de dados. Não
constitui aconselhamento jurídico. Recomenda-se revisão por profissional
jurídico especializado em LGPD antes do lançamento comercial.
