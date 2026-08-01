# Roadmap de lançamento pago — 30 dias (01/08 → 31/08/2026)

**Meta:** vender para 5 clientes pagantes até 31/08/2026.
**Como foi feito:** varredura completa ponta a ponta (código real, não só docs) em 6 frentes: docs de prontidão existentes vs. realidade, billing, segurança/LGPD, telas do app autenticado, infra/ops, site de marketing. Auditorias anteriores (`SAAS_PRODUCTION_ROADMAP.md`, `PRIVATE_BETA_READINESS_CHECKLIST.md`, `SAAS_ARCHITECTURE_AUDIT.md`) tinham itens marcados ✅ que não existem no código — este documento é a versão verificada.

Nada aqui exige infra de escala (sem Kubernetes, sem multi-região). Calibrado pra "vender com confiança pra 5 pessoas", não pra 5.000.

---

## 🔴 P0 — Bloqueia vender pra qualquer pessoa — TODOS CORRIGIDOS ✅

Commit `5cbbe8b`. Cada um destes, se um prospect ou cliente pagante encontrar, mataria a venda ou geraria reembolso/vergonha.

1. ✅ **"Esqueci minha senha" / "Redefinir senha" eram fakes** — agora chamam `resetPasswordForEmail()`/`updateUser()` de verdade, com estado de link inválido/expirado. `/verificar-email` deixou de ser placeholder.
2. ✅ **Métrica "Taxa de resposta" inventada** (tooltip dizia "simulada") — trocada pela taxa de conversão real (`a.conv`), já calculada e sem uso.
3. ✅ **Texto "simulado" na tela inicial do mapa** — removido.
4. ✅ **Botão "Filtros" morto na sidebar** — removido.
5. ✅ **Falha de rede invisível em Kanban/Hoje/Agenda/Painel** — agora mostram `ErrorState` com retry, igual mapa/histórico.
6. ✅ **Resolução de organização não-determinística no backend** (`requireAuth()`) — `ORDER BY` determinístico; `delete-account-data` agora exige `organizationId` explícito do frontend em vez de adivinhar.
7. ✅ **Sem checkbox de termos / consentimento no cadastro** — checkbox já existia (achado incorreto da auditoria original), mas nada persistia a aceitação; agora grava `terms_accepted_at`/`terms_version`.
8. ✅ **Política de Privacidade admitia ser modelo** — aviso removido. Falta razão social/CNPJ real (não inventado — ver pendências abaixo).
9. ✅ **Zero integração de pagamento** — sem Stripe ainda (correto não ter, 30 dias é curto pra isso com segurança). Tela de cadastro com plano pago e configurações agora abrem o `SalesContactForm` (que já existia mas não era usado aqui) em vez de dar beco sem saída.

## 🟠 P1 — Antes da primeira demo/piloto real — quase tudo corrigido

Commit `6cd9738`.

10. ✅ Sitemap.xml — domínio placeholder trocado por `radarlocal.com.br` (inferido dos e-mails já usados no código; confirma antes de submeter no Search Console).
11. ⬜ **OG image é SVG** — WhatsApp/LinkedIn não renderizam bem. Precisa de um PNG gerado a partir do SVG atual; não fiz por não ter ferramenta de conversão de imagem disponível nesta sessão.
12. ✅ Link morto `#fundadores` (testimonials) — agora abre `SalesContactForm` direto.
13. ✅ Footer "Para agências" — aponta pra rota certa `/para-agencias`.
14. ✅ `error_events` sem alerta — cron `error-digest` a cada 30min, e-mail agrupado se houver erro novo. **Precisa `supabase db push` + `supabase functions deploy error-digest` + configurar `ADMIN_ALERT_EMAIL`** — não fiz o deploy nem tenho esse e-mail.
15. ⬜ **Sem monitoramento de uptime** — ação externa (UptimeRobot/Better Uptime), não é código. Aponta pro `/health-check/ready` que já existe.
16. ⬜ **Confirmar plano do Supabase + testar restore de verdade** — ação sua no dashboard, não posso fazer.
17. ⬜ **Confirmar Vault secrets do cron em produção** (`project_url`, `service_role_key`) — mesmos secrets que o novo `error-digest` cron também precisa. Ação sua via SQL editor do Supabase.
18. ✅ `app.historico.tsx` — estado de erro padronizado com `ErrorState`/retry.

## 🟡 P2 — Pode esperar depois dos 5 clientes

19. Full Stripe (checkout, webhook, portal, PIX/boleto automatizado) — só depois de validar que tem gente disposta a pagar.
20. Engine de entitlements não ligada ao gate real de busca (ainda usa `organizations.monthly_search_limit` antigo) — ok pra 5 clientes controlados manualmente.
21. CI sem CD automatizado / sem smoke test pós-deploy — ok em escala pequena com deploy manual, mas documentar o passo de `curl .../health-check/ready` no runbook pra não pular sob pressão.
22. Headers de segurança HTTP, pequenas exposições de baixo risco — defesa em profundidade, não risco real hoje.
23. `docs/COST_CONTROL.md` referencia pesos de score desatualizados (v1) — limpeza de doc.

---

## Pendências que só você resolve (não são código)

- **CNPJ/razão social/endereço real** para `privacidade.tsx` — deixei marcado com TODO no código, não inventei nada. Sem isso a política fica incompleta.
- **`SALES_NOTIFY_EMAIL`** e **`ADMIN_ALERT_EMAIL`** — configurar em `.env.local` e via `supabase secrets set`. Sem eles, "falar com a gente" e os alertas de erro rodam silenciosos.
- **Deploy pendente:** `supabase db push` (migration do `error-digest` cron) + `supabase functions deploy error-digest` + `supabase functions deploy delete-account-data` (mudou a assinatura) + `supabase functions deploy submit-sales-contact` — nada disso foi enviado pra produção nesta sessão, só está no repo.
- **Revisão jurídica real** de Termos/Privacidade — o conteúdo é substancial mas não foi validado por advogado.
- Uptime monitor, confirmação do plano/restore do Supabase, confirmação dos Vault secrets — itens 15/16/17 acima.

## Pendências de polish de auth — resolvidas ou ainda abertas

- ✅ Checkbox "Manter conectado" — corrigido (estava duplamente quebrado: nem chegava no form data por causa de como o `Checkbox` do Radix integra com react-hook-form, nem tinha efeito real no Supabase client). Testado ao vivo.
- ✅ Google Auth travando o form em erro — corrigido com `onError` + toast.
- ✅ `recuperar-senha`/`redefinir-senha` com layout diferente — migradas para `AuthLayout` (mesmo visual do login/cadastro); `AuthCard` ficou morto e foi removido.
- ✅ Política de senha inconsistente (6 vs 8 caracteres) — unificada em 8.
- ⬜ Medidor de força do cadastro mostra 4 requisitos visuais (maiúscula/número/especial/8 chars) mas o schema Zod só valida o comprimento — indicador visualmente engana, ainda não corrigido.

---

## Ordem de execução sugerida (semana a semana)

**Semana 1 (02–08/08):** ~~todo o P0~~ ✅ feito. Falta: deploy das edge functions/migration pendentes + as pendências "só você resolve" acima.
**Semana 2 (09–15/08):** P1 restante (OG image PNG, uptime monitor, restore test, medidor de senha) — produto pronto pra primeira demo ao vivo.
**Semana 3 (16–22/08):** primeiras demos/pilotos, ajustar com feedback real, iniciar cobrança manual (PIX/link de pagamento) dos primeiros interessados.
**Semana 4 (23–31/08):** fechar os 5, resolver o que aparecer no uso real, P2 só se sobrar tempo.
