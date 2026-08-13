# Discovery Intelligence V2 — Configuração externa (providers)

> Spec #106. O que está pronto, o que falta de credencial, e o que é mock/Noop.

| Provider | Implementação | Configurado | Credencial pendente | Status |
|---|---|---|---|---|
| Google Places (search) | Edge functions `execute-search` + cache 3 níveis | ✅ (real mode) | — | **Ativo** |
| Google Geocoding | `geocode-location` + `geocode_cache` | ✅ | — | **Ativo** |
| Website scraper (enriquecimento) | `_shared/enrich.ts` (SSRF-guard) | ✅ | — | **Ativo** |
| Scoring (determinístico) | `score.ts` v3.0.0 + `opportunity-score.ts` v1.0.0 | ✅ | — | **Ativo** |
| Intent parser (determinístico) | `search-intent.ts` | ✅ | — | **Ativo** (fallback) |
| Intent parser (LLM) | — | ❌ | chave/modelo (Anthropic já parcial via `aiMessage`) | **Pendente** |
| Business Registry (CNPJ/CNAE) | — (adapter `CompanySourceProvider.public_business_registry` previsto) | ❌ | provider/credencial | **Pendente** |
| WhatsApp validation | `whatsapp_status` (unknown/possible/verified/invalid) + `_shared/enrich` | 🟡 | provider dedicado | **Parcial** |
| Social (Instagram/Facebook/LinkedIn) | — | ❌ | provider | **Pendente** |
| Reputation (sentiment/keywords) | — | ❌ | provider/IA | **Pendente** |

## Env para V2

```bash
# flags V2 (build-time, frontend)
VITE_FEATURE_DISCOVERY_V2=true          # hoje default true em código
VITE_FEATURE_CNAE_INTELLIGENCE=false    # default false até fonte cadastral
```

Os providers pendentes seguem o padrão: **adapter + `Noop`/`Mock`** para testes,
`env.example` documenta o setup, e produção sabe que o provider está desabilitado
(`integrationStatuses()` já expõe "Somente em modo real" para o que não tem chave).
