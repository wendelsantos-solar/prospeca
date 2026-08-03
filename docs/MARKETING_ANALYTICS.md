# Marketing Analytics — Prospeca

Eventos de analytics configurados para o site público e fluxo de conversão.

## Provider

`lib/analytics.ts` — `track()` function. Em modo real, persiste em `usage_events`
(Supabase). Em modo demo, apenas loga no console.

**Sem provedor externo conectado ainda** (PostHog, GA4, Plausible, etc.).
A função `track()` é o único ponto de contato — trocar o provider nunca
exige alterar call sites.

## Eventos de aquisição

| Evento                    | Quando                      | Props                                                                        |
| ------------------------- | --------------------------- | ---------------------------------------------------------------------------- |
| `landing_viewed`          | Landing page carrega        | `{}`                                                                         |
| `hero_cta_clicked`        | CTA principal clicado       | `{ location: "hero_primary" \| "header" \| "header_mobile" \| "final_cta" }` |
| `demo_clicked`            | "Ver como funciona" clicado | `{ location: "hero" }`                                                       |
| `pricing_viewed`          | `/precos` carrega           | `{}`                                                                         |
| `plan_selected`           | Plano selecionado           | `{ plan: string }`                                                           |
| `signup_started`          | Cadastro iniciado           | `{ plan: string, source?: string }`                                          |
| `signup_completed`        | Cadastro concluído          | `{ plan: string }`                                                           |
| `faq_opened`              | Pergunta do FAQ expandida   | `{ question: string }`                                                       |
| `founder_offer_viewed`    | Oferta fundadores visível   | `{ source?: string }`                                                        |
| `sales_contact_started`   | Form de contato aberto      | `{ source: string }`                                                         |
| `sales_contact_completed` | Form de contato enviado     | `{ source: string }`                                                         |

## Eventos de produto (app autenticado)

| Evento                   | Quando                    |
| ------------------------ | ------------------------- |
| `search_completed`       | Busca concluída           |
| `lead_viewed`            | Lead aberto no drawer     |
| `lead_added_to_pipeline` | Lead movido para Pipeline |
| `lead_stage_changed`     | Estágio alterado          |
| `message_prepared`       | Mensagem preparada        |
| `activity_created`       | Atividade criada          |
| `activity_completed`     | Atividade concluída       |
| `export_completed`       | Exportação concluída      |
| `plan_upgrade_started`   | Upgrade iniciado          |
| `feedback_submitted`     | Feedback enviado          |

## UTM tracking

`lib/utm.ts` — captura UTMs de `?utm_source=...` na primeira visita e preserva
em `sessionStorage`. Sobrevive à navegação `/` → `/precos` → `/cadastro`.

Parâmetros capturados:

- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`
- `referrer` (via `document.referrer`)

## Implementação

Para adicionar tracking a um novo componente:

```tsx
import { track } from "@/lib/analytics";

// Em onClick:
onClick={() => track("event_name", { prop: "value" })}
```

Nunca passe dados pessoais para `track()`. O `metadata` é armazenado como JSONB
no Supabase e visível para administradores.
