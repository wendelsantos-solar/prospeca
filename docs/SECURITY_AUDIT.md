# Security Audit — Prospeca (Update 2026-08-06)

**Data:** 2026-08-06
**Base:** Auditoria anterior (2026-07-30) + pentest ofensivo direcionado

---

## Resumo executivo

A base de segurança continua **sólida**. A auditoria de 2026-07-23 identificou
3 vulnerabilidades — todas resolvidas. Esta atualização revisa o estado atual
e adiciona verificações para o beta privado.

---

## Classificação de severidade

| Nível  | Descrição                                           |
| ------ | --------------------------------------------------- |
| **S4** | Crítico — acesso não autorizado, vazamento de dados |
| **S3** | Alto — bypass de controle, exposição de PII         |
| **S2** | Médio — hardening, configuração                     |
| **S1** | Baixo — boas práticas                               |

---

## Achados anteriores (todos resolvidos)

| ID  | Descrição                               | Severidade | Status                    |
| --- | --------------------------------------- | ---------- | ------------------------- |
| V1  | Suppression list não aplicada           | S3         | ✅ Resolvido (2026-07-23) |
| V2  | Sem retenção/minimização de PII         | S2         | ✅ Resolvido (2026-07-23) |
| V3  | Comparação de segredo não constant-time | S2         | ✅ Resolvido (2026-07-23) |

---

## Novos achados

### S2-01: Rate limiting não uniforme

**Severidade:** S2 (Médio)
**CWE:** CWE-770 (Uncontrolled Resource Consumption)

**Descrição:** `assertRateLimit()` existe no `_shared/quota.ts` mas não é
aplicado em todas as edge functions públicas. `create-search` usa, mas
`submit-feedback`, `accept-invitation` e `enrich-discovery` não têm rate
limit explícito.

**Risco:** Ataque de força bruta ou consumo excessivo de recursos em
endpoints sem proteção.

**Recomendação:** Aplicar `assertRateLimit()` em todas as edge functions
públicas com limites razoáveis por operação.

**Correção:** Adicionar rate limit nas novas edge functions.

---

### S1-02: Headers de segurança ausentes

**Severidade:** S1 (Baixo)
**OWASP:** A05:2021 – Security Misconfiguration

**Descrição:** As respostas HTTP não incluem headers de segurança como
`Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`.

**Risco:** Baixo para o cenário atual (SPA + API). Mitigável com configuração
de CDN ou reverse proxy.

**Recomendação:** Adicionar headers via Supabase ou CDN/hosting.

---

### S1-03: `useTenant` expõe todas organizations do usuário

**Severidade:** S1 (Baixo)

**Descrição:** O hook `useTenant()` busca todas as organizations do usuário
e as retorna. Para o beta com 1 org/usuário, não há risco. Quando houver
múltiplas orgs, o frontend exibirá a lista.

**Risco:** Baixo. Dados já pertencem ao usuário autenticado.

**Recomendação:** Manter como está. Revisar quando implementar workspace
switcher.

---

## Achados da revisão 2026-07-30 (auditoria de evidência)

Estes achados vieram de reauditar o que os commits `c508d40`/`3757b45`
**declaravam** ter entregue contra o que o código de fato fazia. Todos foram
reproduzidos, não inferidos.

### S3-04: Rate limiting declarado mas inerte (corrigido)

**Severidade:** S3 (Alto)
**CWE:** CWE-770 (Uncontrolled Resource Consumption) + CWE-390 (Detection of Error Condition Without Action)
**OWASP:** A04:2021 – Insecure Design / API4:2023 – Unrestricted Resource Consumption
**CVSS v3.1 estimado:** 5.3 (AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:N/A:L)

**Descrição.** `_shared/rate-limit.ts` (criado para resolver o S2-01) gravava o
contador da janela em `usage_events` com `event_type = 'rate_limit_*'`. Mas
`usage_events.event_type` tem CHECK restrito a 6 tipos de custo
(`20260719000004_ops.sql:21`). Todo INSERT violava o CHECK; o retorno de erro
**não era verificado**; o contador nunca incrementava; a contagem voltava sempre
0 — logo o limite **nunca disparava** em `accept-invitation`, `submit-feedback` e
`create-pilot`.

**Evidência (reproduzido em banco local):**

```
NOTICE:  OLD_PATH_CHECK_VIOLATION -- bug original confirmado
```

Obtido tentando o INSERT exato que a função fazia:
`insert into usage_events (organization_id, event_type, quantity) values (..., 'rate_limit_invitation', 1)`.

**Agravantes encontrados no mesmo código:**

- `accept-invitation` passava o UUID zerado `00000000-...` como escopo, criando um
  **balde global compartilhado**: qualquer chamador poderia esgotar o limite e
  negar o aceite de convite para todos os usuários (auto-DoS).
- `create-pilot` passava `userId` no parâmetro `organizationId` — além de errado
  semanticamente, violaria a FK para `organizations`.
- O limitador falhava aberto (`fail open`) **em silêncio**, o que foi exatamente o
  que permitiu o defeito passar despercebido.

**Impacto de negócio.** Proteção antiabuso e de custo anunciada nos documentos de
readiness mas ausente na prática — falsa sensação de cobertura na decisão de abrir
o beta.

**Correção.** `20260730000004_rate_limit_events.sql` cria tabela dedicada com
`scope_key text` (sem FK, porque aceitar convite ocorre antes de haver organização
resolvida), RLS habilitada **sem policies** e grants revogados de
`anon`/`authenticated`. `_shared/rate-limit.ts` reescrito: escopo por usuário via
`scope.byUser()`, erro de INSERT verificado e logado como `rate_limit_degraded`.
Expurgo horário via `pg_cron`.

**Teste.** ISO-021 confirma que o cliente não lê nem escreve `rate_limit_events`.

---

### S3-05: `usage_events` sem policy de INSERT — analytics de produto nunca persistia (corrigido)

**Severidade:** S3 (Alto) — para a capacidade de operar o beta; **S1** como risco de acesso
**CWE:** CWE-390 (Detection of Error Condition Without Action)
**OWASP:** A09:2021 – Security Logging and Monitoring Failures

**Descrição.** `usage_events` tem RLS habilitada desde `20260719000005_rls.sql`
com **apenas** a policy `usage_select` (SELECT) — o comentário no arquivo diz
"audit written by edge functions / triggers only". Mas
`apps/web/src/lib/analytics.ts` (`track()`) inseria direto do browser com a chave
anon. Sem policy de INSERT, a RLS rejeitava 100% dessas gravações, e o callback de
erro era literalmente vazio (`() => {}, // Silently ignore persistence errors`).
Somava-se a isto: `organization_id` era enviado como `null` numa coluna
`NOT NULL`, e `setAnalyticsContext()` **nunca era chamado** em lugar nenhum.

**Impacto de negócio.** Zero eventos de produto persistidos. O modelo de ativação
(`docs/PRODUCT_ACTIVATION_MODEL.md`), o analytics de produto e o painel de
acompanhamento de pilotos ficavam sem fonte de dados — ou seja, o beta rodaria
sem a capacidade de medir se alguém ativou. Isso anula o propósito declarado do
beta privado.

**Correção.** `20260730000005_product_events_insert_policy.sql` adiciona
`usage_events_product_insert`, deliberadamente estreita porque `usage_events` é
**também** a base de custo e de quota. A policy exige: `metric` preenchido,
`event_type` nulo, `estimated_cost` nulo, `provider` nulo, `quantity = 1`,
`source_type = 'product_event'`, `user_id = auth.uid()` e membership na
organização. `track()` ajustado para casar exatamente essa forma, e passou a
avisar no console quando não persiste.

**Testes.** ISO-017 (forja de evento de custo barrada), ISO-018 (evento de produto
legítimo passa), ISO-019 (não grava em organização alheia), ISO-020 (não atribui
evento a outro usuário).

---

### S2-06: Resolução de organização não determinística (corrigido)

**Severidade:** S2 (Médio)
**CWE:** CWE-670 (Always-Incorrect Control Flow Implementation)

**Descrição.** `apps/web/src/repositories/supabase.ts` resolvia a organização com
`from("organization_members").select("organization_id").limit(1)` — sem `ORDER BY`
e sem filtro de usuário — em dois pontos (escrita da `suppression_list` e
`get_dashboard_overview`).

**Não é vazamento cross-tenant:** a RLS de `organization_members` impede ver
membership de outro usuário, e os testes ISO-004 confirmam. O problema é que, com
2+ organizações do **próprio** usuário, o Postgres devolve linhas em ordem
arbitrária e a organização escolhida podia mudar entre carregamentos — gravando
opt-out de contato ou lendo dashboard na organização errada.

**Por que não era hipotético.** `handle_new_user()` cria uma organização Free para
todo usuário novo; quem entra por convite (todo piloto) fica com duas.

**Correção.** `apps/web/src/lib/tenant.ts` passa a ser a fonte única
(`resolveActiveOrganizationId()`), com ordem total (`created_at`, depois
`organization_id`), filtro explícito `.eq("user_id", ...)` como defesa em
profundidade, e seleção explícita persistida honrada só se ainda for membership
válida.

---

### S1-07: Propriedade da organização do piloto não era transferida (corrigido)

**Severidade:** S1 (Baixo)

**Descrição.** `create-pilot` criava a organização com `owner_user_id` = admin da
plataforma (comentado como "temporarily owned by admin"); nada transferia depois.

**Por que S1 e não mais.** Auditado: `owner_user_id` **não aparece em nenhuma
policy de RLS** — `is_organization_member()` e `has_organization_role()` leem
exclusivamente `organization_members`. Logo o admin **não** ganhava acesso aos
dados do tenant por esse campo. O impacto é de integridade de dado e ownership
(billing, transferência de conta), não de autorização.

**Correção.** `accept-invitation` transfere `owner_user_id` quando o convite é de
`owner` e o dono atual não é membro real, e avança `pilot_status` para
`onboarding` com guarda contra regressão de estado.

---

### S2-08: Convite de piloto nunca era consumido (corrigido)

**Severidade:** S2 (Médio) — funcional, com efeito colateral de segurança

**Descrição.** O token do convite era guardado em
`user_metadata.invitation_token` no cadastro e **nunca consumido** — nenhum código
chamava `accept-invitation`. Efeito de segurança: um token de uso único ficava
armazenado indefinidamente no metadata do usuário.

**Correção.** `hooks/usePendingInvitation.ts` consome o token no primeiro
carregamento autenticado e o **limpa em qualquer desfecho** (sucesso, expirado ou
já usado), para não ficar residente nem ser retentado a cada load.

---

### Observação sobre S1-03 (revisado)

O achado S1-03 ("`useTenant` expõe todas organizations do usuário") continua
válido e de risco baixo — os dados pertencem ao próprio usuário autenticado. Mas
a recomendação "manter como está" foi **revisada**: o hook não tinha nenhum
consumidor e a ausência de ordenação era um defeito real (ver S2-06).

---

## Achados da revisão 2026-08-06 (pentest ofensivo)

### S3-09: SSRF via redirect e DNS rebinding no enriquecimento de site (corrigido)

**Severidade:** S3 (Alto)
**CWE:** CWE-918 (Server-Side Request Forgery)
**OWASP:** A10:2021 – Server-Side Request Forgery

**Descrição.** `_shared/enrich.ts` (`enrichFromWebsite`) valida a URL do site
do lead com `assertSafeUrl()` antes do fetch — mas essa validação só checa o
**hostname literal** da requisição inicial. O código tinha, no próprio
comentário, o gap documentado e não fechado: "when a DNS resolver is
available, resolve and re-check the resolved IP too." Dois bypasses ficavam
abertos:

1. **Redirect não revalidado.** O fetch usava `redirect: "follow"`. Um host
   público (que passa no guard) podia responder com `302 Location:
http://169.254.169.254/latest/meta-data/` (ou qualquer IP privado) e o
   Deno seguia o redirect sem checar o novo destino.
2. **DNS rebinding.** Um hostname com aparência pública (`attacker.com`) pode
   resolver para um IP privado/metadata. `assertSafeUrl()` nunca resolve DNS,
   então esse caso passava direto.

**Por que não é hipotético.** O campo `website` que alimenta
`enrichFromWebsite` vem do Google Places (`websiteUri`), e `enrich-discovery`
roda automaticamente em toda busca — sem ação humana. Qualquer pessoa pode
cadastrar um estabelecimento no Google Maps com um site controlado por ela;
basta que o nicho/região seja pesquisado por algum usuário da plataforma para
o servidor da Prospeca buscar essa URL. Não exige credenciais na Prospeca.

**Correção.** `supabase/functions/_shared/enrich.ts`: `redirect: "manual"` +
revalidação (`assertSafeUrlResolved`) em cada hop, limitado a 3 redirects
(`safeFetch`); resolução de DNS via `Deno.resolveDns` antes do fetch inicial,
rejeitando hosts cujo IP resolvido caia em faixa privada/loopback/link-
local/CGNAT (reusa `isPrivateIpv4`/`isPrivateIpv6` de `@leads/domain/ssrf`).
Fail-closed: hostname sem resolução DNS é tratado como inseguro.
`enrich-lead`/`enrich-discovery` redeployados.

**Pendência.** Sem teste automatizado de rede (mock de DNS/redirect) neste
commit — `deno check`/`deno lint` passam, mas o exploit em si não tem
regressão codificada. Mesma lição do S3-04/S3-05 desta auditoria: controle
sem teste que o exercite é risco latente até o exercitar.

---

## Checklist de segurança para beta

| Item                                                  | Status                                                                  |
| ----------------------------------------------------- | ----------------------------------------------------------------------- |
| RLS em todas tabelas                                  | ✅                                                                      |
| Autenticação em todas edge functions                  | ✅                                                                      |
| Backend valida authorization (não confia no frontend) | ✅                                                                      |
| Service role restrito a funções internas              | ✅                                                                      |
| Secrets não hardcoded                                 | ✅                                                                      |
| SSRF protegido (enrich)                               | ✅ Corrigido (S3-09) — redirect e DNS rebinding fechados 2026-08-06     |
| Rate limiting em create-search                        | ✅                                                                      |
| Rate limiting nas novas funções                       | ✅ Corrigido (S3-04) — antes estava inerte                              |
| Headers de segurança                                  | ✅ `_shared/http.ts`                                                    |
| LGPD: exclusão de conta                               | ✅                                                                      |
| LGPD: retenção de dados                               | ✅                                                                      |
| LGPD: suppression opt-out                             | ✅                                                                      |
| LGPD: Termos de Uso / Política de Privacidade         | ✅ `routes/termos.tsx`, `routes/privacidade.tsx` (sem revisão jurídica) |
| CSRF (Supabase gerencia)                              | ✅                                                                      |
| CORS configurado                                      | ✅                                                                      |
| Input validation (Zod)                                | ✅                                                                      |
| Audit logs em ações críticas                          | ⚠️ Parcial — falta alteração de role e de limite                        |
| Testes de isolamento cross-tenant                     | ✅ 23/23 em `supabase/tests/rls-isolation.test.ts`                      |
| Cliente barrado de escrever na base de custo          | ✅ Corrigido (S3-05)                                                    |
| Error tracking                                        | ❌ Pendente — nenhuma integração                                        |
| CI com gates de segurança                             | ❌ Pendente                                                             |

---

## Conclusão (revisão 2026-07-30)

**Segurança de acesso: sólida e agora comprovada por teste.** O isolamento
cross-tenant deixou de ser afirmação e passou a ter 23 testes contra Postgres +
RLS real (dois usuários, duas organizações, chave anon do browser), cobrindo
leitura por UUID conhecido, escrita, exclusão, insert cross-tenant, auto-promoção
a membro e acesso anônimo. Nenhuma falha de isolamento encontrada.

**A lição desta revisão não é sobre policies — é sobre verificação.** Nenhum dos
achados S3 desta rodada foi uma policy mal escrita. Todos foram **controles que
existiam no código, estavam documentados como prontos, e não funcionavam**:
rate limit gravando em coluna com CHECK incompatível, analytics inserindo em
tabela sem policy de INSERT — ambos com o erro engolido por um handler vazio.
Um `catch` vazio e um erro de INSERT não verificado esconderam dois controles
inertes por duas entregas inteiras.

Daí a recomendação operacional de maior valor: **erro de escrita nunca deve ser
descartado em silêncio**, nem em caminho não crítico como analytics. E controle
de segurança sem teste que o exercite deve ser tratado como ausente até prova em
contrário.

**Pendências que bloqueiam o beta** (nenhuma é de acesso): error tracking (sem
ele, falha de piloto real é invisível) e CI com gates (sem ele, nada impede a
regressão que produziu estes achados).
