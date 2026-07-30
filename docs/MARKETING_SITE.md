# Site comercial — Radar Local

Status: **Fase 1 implementada** (Home + `/precos` + form de vendas). Rotas
`/para-agencias`, `/recursos`, `/contato`, `/blog`, `/guias`, `/casos`, E2E e
os demais docs (`SEO.md`, `ANALYTICS_EVENTS.md`, `CONVERSION_TRACKING.md`)
ficam para sessões seguintes.

## Rotas

- `/` — antes só fazia `redirect({ to: "/app/mapa" })`. Agora: autenticado
  (ou modo demo) continua indo direto pro app; anônimo vê a landing
  (`apps/web/src/components/marketing/LandingPage.tsx`). O redirect virou um
  `useEffect` client-side em `routes/index.tsx` (mesmo idioma do
  `AuthGate` em `routes/app.tsx` — não existe checagem de sessão via
  `beforeLoad` no projeto, então não introduzi uma isolada).
- `/precos` — nova, `PricingPage.tsx`. Busca planos direto de
  `billing_plans` (RLS pública, `select using (true)`) via
  `lib/billing-plans.ts` — nenhum preço é hardcoded na UI.
- `/para-agencias` **não existe ainda** — a seção "Para agências" vive como
  âncora (`#agencias`) dentro da home nesta fase.

## CTA de plano pago sem checkout real

Billing Fase 2 (Stripe) ainda não existe. `PlanCard` leva pra
`/cadastro?plan={code}`; o cadastro grava `intended_plan` em
`organizations` (coluna nova, migration
`20260729000004_landing_marketing.sql`) — **não** altera a subscription
real (toda org nasce em `free` de verdade). Pós-cadastro, se o plano
escolhido não for `free`, mostra aviso honesto em vez de fingir checkout:
"Pagamentos ainda não estão abertos... a gente avisa assim que puder
migrar." Ver `routes/cadastro.tsx`.

## Form de vendas

`SalesContactForm` (Dialog reutilizável, usado no header/footer/preços/
oferta fundadores) → edge function `submit-sales-contact` → tabela
`sales_contacts`. **Primeira function pública do projeto** — todas as
outras exigem `requireAuth()`. Proteções (documentadas como limitação
conhecida, não é anti-abuso robusto):

- honeypot (campo `website`, escondido via CSS — bot preenche, humano não)
- rate limit: 1 envio por e-mail a cada 60s
- zod valida tamanho/formato de tudo

Testado direto via curl contra o projeto linkado: envio real grava,
honeypot não grava nada, segunda tentativa com mesmo e-mail em <60s é
recusada (`RATE_LIMIT_EXCEEDED`).

## Oferta fundadores

`founder_offer` (tabela nova, 1 linha, `is_active = false` por padrão).
`FounderOffer.tsx` renderiza `null` enquanto a flag estiver desligada —
não inventamos "vagas restantes". Pra ativar de verdade:

```sql
update public.founder_offer
set is_active = true, seats_total = <N>, price_cents = <preço>, ends_at = <data>;
```

## Analytics e UTM (stubs)

`lib/analytics.ts` — `track()` só loga em dev (`isRealMode`), sem enviar
pra provedor nenhum (decisão registrada: sem PostHog/GA/Plausible
conectado ainda). `lib/utm.ts` — captura UTM/referrer em `sessionStorage`
na primeira visita, sobrevive à navegação `/` → `/precos` → `/cadastro`.

## SEO

SSR real (TanStack Start, `ssr: true`) — `head()` por rota funciona de
verdade, não é meta tag decorativa numa SPA. `index.tsx`/`precos.tsx` têm
title/description/OG próprios; o resto herda o default de `__root.tsx`.
`public/robots.txt` e `public/sitemap.xml` criados — **o sitemap usa o
domínio placeholder `seudominio.com`** (mesma convenção já usada em
`docs/DEPLOYMENT.md`) porque o domínio real de produção não foi
informado. Trocar antes do lançamento.

## Pendências conhecidas (não resolvidas nesta fase)

- Sem páginas `/termos` e `/privacidade` — o footer não linka pra elas
  (não crio link morto). Precisam de revisão jurídica antes de existir.
- Sem CNPJ/dados empresariais, redes sociais ou blog/status reais no
  footer — nada disso existe ainda, não foi inventado.
- Rate limit da function de vendas é ingênuo (por e-mail, sem IP/CAPTCHA).
- `/para-agencias`, `/recursos` como rota própria, `/blog`, `/guias`,
  `/casos`, testes E2E: não implementados.
