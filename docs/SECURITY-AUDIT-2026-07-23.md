# Auditoria de Segurança & LGPD — Radar Local

**Data:** 2026-07-23 · **Escopo:** monorepo (edge functions, RLS/migrations, web) · **Metodologia:** revisão de código (OWASP Top 10, API Top 10, CWE, LGPD).

## 1. Resumo Executivo

Base de segurança **sólida** para um SaaS multi-tenant: RLS habilitada em todas as tabelas com escopo por organização (`is_organization_member`), autenticação em todas as edge functions públicas, guarda de SSRF no scraping, rate-limit nas operações sensíveis, endpoint de erasure (LGPD) e **nenhum PII/segredo em logs**.

Os riscos concentram-se em **conformidade LGPD**, não em falhas de acesso: o produto coleta PII de terceiros (e-mail/telefone/WhatsApp/Instagram de empresas, muitas MEI/pessoa física) e hoje **não respeita opt-out** nem **expurga** esse dado. Isso é o maior passivo — cresce a cada busca.

| Severidade    | Qtd | Tema                                               |
| ------------- | --- | -------------------------------------------------- |
| 🔴 Alto       | 1   | Opt-out (suppression) não aplicado                 |
| 🟠 Médio      | 2   | Retenção/minimização de PII; comparação de segredo |
| 🟢 Baixo/Info | —   | Hardening + DevSecOps                              |

Nenhuma falha crítica de acesso (IDOR/broken-access) encontrada nesta passada.

## 2. Vulnerabilidades Encontradas

### 🔴 V1 — Lista de supressão (opt-out) não é aplicada ✅ RESOLVIDO (2026-07-23)

> Implementado: ação "Não contatar" (drawer) grava hash sha256 de telefone+email na `suppression_list` (org-scoped); todos os caminhos de contato (card, popup do mapa, disparo em massa, WhatsApp do drawer) bloqueiam envio a contato suprimido. `apps/web/src/lib/suppression.ts` + hooks. Falta: canal público de opt-out (data subject externo) — ver Roadmap #4.

- **Severidade:** Alto
- **CWE:** CWE-285 (Improper Authorization of data use) · **OWASP:** A04 Insecure Design · **LGPD:** arts. 18 (oposição/eliminação), 7/10 (base legal)
- **CVSS v3.1 (estimado):** 6.5 (contexto legal/reputacional, não técnico)
- **Evidência:** tabela `public.suppression_list` existe (`20260719000005_rls.sql`) mas `grep -rni suppression` no código de runtime (`supabase/functions`, `apps/web/src`) **não retorna nenhuma aplicação**. Nem o disparo em massa (WhatsApp), nem o enrich, nem a descoberta consultam a lista.
- **Impacto de negócio:** contatar quem pediu para não ser contatado → violação LGPD (sanção ANPD, dano reputacional, bloqueio de número WhatsApp).
- **Cenário:** empresa pede remoção → é inserida na suppression_list → próxima busca a re-descobre e o disparo em massa a contata de novo.
- **Remediação:** aplicar a lista como filtro em (a) alvos do disparo em massa, (b) candidatos do enrich, (c) opcionalmente ocultar/marcar na descoberta. Chave por telefone/e-mail normalizado + organização.

```ts
// Inseguro (hoje): alvos do bulk = todos os selecionados
const targets = selected;
// Seguro: filtrar contra suppression_list normalizada
const suppressed = await getSuppressed(orgId); // Set<normalizedPhone|email>
const targets = selected.filter((t) => !suppressed.has(normalizePhone(t.phone).e164));
```

### 🟠 V2 — Sem retenção/minimização do PII raspado ✅ RESOLVIDO (2026-07-23)

> `purge_stale_discovery_pii()` (migration `…000006`) zera email/instagram/whatsapp de places descobertos e não convertidos em lead após 90 dias. pg_cron habilitado (`…000007`) e job `purge-stale-discovery-pii` agendado diariamente 03:00 UTC. Places convertidos (com lead) preservados.

- **Severidade:** Médio
- **CWE:** CWE-359 (Exposure of Private Info) · **OWASP:** A04 · **LGPD:** art. 15/16 (término do tratamento, eliminação)
- **CVSS v3.1 (estimado):** 5.3
- **Evidência:** `provider_search_cache` (7d), `exports` (30d) e `idempotency_keys` expiram; **`places`** (email/telefone/whatsapp/instagram), **`search_results`** e **`leads`** não têm TTL/purga. `grep` por `retention|purge|expire` não acha job para essas tabelas.
- **Impacto:** acúmulo indefinido de PII de terceiros → viola minimização/retenção; aumenta superfície de um eventual vazamento.
- **Remediação:** política de retenção (ex.: purgar `places.email/instagram/whatsapp` + `enriched_at` de discovery não convertida em lead após N dias via `pg_cron`), documentada. Manter o que virou lead (base legal de relacionamento).

### 🟠 V3 — Comparação de segredo não constant-time ✅ RESOLVIDO (2026-07-23)

> `execute-search` usa `timingSafeEqual` (digests SHA-256 de tamanho fixo). Deployado.

- **Severidade:** Baixo→Médio
- **CWE:** CWE-208 (Observable Timing Discrepancy) · **OWASP:** A02
- **Evidência:** `execute-search/index.ts:16-17` — `auth === \`Bearer ${SERVICE_ROLE_KEY}\``(comparação`===`).
- **Impacto:** teórico (segredo de alta entropia). Boa prática: comparação em tempo constante.
- **Remediação:** comparar via hash/timingSafeEqual dos bytes.

## 3. Evidências Técnicas (positivas — manter)

- **RLS:** `20260719000005_rls.sql` — RLS em 19 tabelas, policies org-scoped via `is_organization_member` (SECURITY DEFINER, `search_path` fixado).
- **Auth:** todas as functions públicas usam `requireAuth`; o worker `execute-search` exige `Bearer SERVICE_ROLE_KEY`.
- **SSRF:** `enrichFromWebsite` usa `assertSafeUrl` + timeout + limite de payload.
- **Export:** `create-export` filtra `.eq("organization_id", …)` + rate-limit (3) → sem vazamento cross-org.
- **Erasure:** `delete-account-data` apaga a org em cascata (LGPD art. 18).
- **Logs:** sem PII/segredo em `logEvent` (verificado).
- **Injeção Overpass:** `query.replace(/["\\]/g,"")` neutraliza quebra da string `name~"..."`.

## 4. Impacto de Negócio

O gargalo não é invasão — é **conformidade**. Sem opt-out e retenção, cada busca amplia o passivo LGPD e o risco de bloqueio de WhatsApp por spam. Resolver V1+V2 é barato agora e caro depois.

## 5. Plano de Remediação

| #   | Ação                                        | Esforço | Prioridade           |
| --- | ------------------------------------------- | ------- | -------------------- |
| V1  | Aplicar suppression_list no bulk + enrich   | Baixo   | **Agora**            |
| V2  | Política + job de retenção de PII (pg_cron) | Médio   | Próximo              |
| V3  | Comparação constant-time no worker          | Trivial | Oportuno             |
| CI  | Gate typecheck+lint+test em PR              | Baixo   | ✅ feito neste ciclo |

## 6. Quick Wins

- ✅ **CI gate** (`.github/workflows/ci.yml`) — typecheck + lint + `bun test` em PR/push.
- **V1 suppression** — maior valor/risco por esforço.
- **V3 constant-time** — 5 linhas.

## 7. Roadmap de Correção

1. **Sprint atual:** V1 (opt-out) + V3 (constant-time). CI já ativo.
2. **Próximo:** V2 (retenção via `pg_cron` + doc de política de dados).
3. **DevSecOps contínuo:** SCA + secret-scanning no CI (Dependabot/gitleaks), observabilidade de erros das edge functions (Sentry), e um teste de RLS automatizado (cross-org deve retornar vazio).
4. **Documentar base legal** (legítimo interesse) e canal público de opt-out — pré-requisito de conformidade.
