# Segurança — Radar Local

## Segredos

- `SUPABASE_SERVICE_ROLE_KEY` e `GOOGLE_MAPS_SERVER_KEY`: apenas Edge Functions
  (Supabase secrets). Nunca no bundle, nunca em logs, nunca no repositório.
- Frontend recebe somente `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `VITE_GOOGLE_MAPS_BROWSER_KEY` (restrita por domínio).
- `.env` está no `.gitignore`; use `.env.example` como referência.

## Autenticação e autorização

- Supabase Auth (e-mail/senha; recuperação de senha implementada).
- Edge Functions: `requireAuth()` valida JWT + membership da organização.
- `execute-search` aceita apenas chamadas internas com service role.
- RLS ativa em todas as tabelas; política central `is_organization_member()`.
- Frontend nunca é confiável: filtros de organização acontecem no banco.

## Proteções implementadas

| Vetor                 | Mitigação                                      |
| --------------------- | ---------------------------------------------- |
| Vazamento de chave    | chaves server-side apenas em Edge Functions    |
| Acesso cross-tenant   | RLS + verificação de membership em toda função |
| Replay/duplo clique   | `idempotency_keys` (unique org+key+operation)  |
| Abuso de API          | rate limit por org/operação + quotas mensais   |
| CSV formula injection | `sanitizeCell` prefixa `'` em `=+-@`           |
| Loops de paginação    | `ABSOLUTE_MAX_PAGES = 3` por execução          |
| Stack trace exposto   | erros padronizados `ApiError` com `requestId`  |

## SSRF (enriquecimento de website — Fase 7)

Quando o `WebsiteEnrichmentProvider` for ativado, obrigatório:

- Apenas `http`/`https`; resolução DNS antes do fetch.
- Bloquear `127.0.0.1`, `0.0.0.0`, `169.254.169.254`, RFC1918, IPv6 local.
- Limite de redirects (rechecando IP a cada salto), timeout, tamanho máximo,
  validação de content-type; nunca retornar HTML bruto ao frontend.

## Logs

Logs estruturados (JSON) com `requestId`, `operation`, `organizationId`,
`durationMs`, `status`, `errorCode`. Proibido: chaves, tokens, senhas,
payloads completos, dados pessoais sensíveis.
