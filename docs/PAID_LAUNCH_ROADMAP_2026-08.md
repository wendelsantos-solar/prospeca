# Roadmap de lançamento pago — 30 dias (01/08 → 31/08/2026)

**Meta:** vender para 5 clientes pagantes até 31/08/2026.
**Como foi feito:** varredura completa ponta a ponta (código real, não só docs) em 6 frentes: docs de prontidão existentes vs. realidade, billing, segurança/LGPD, telas do app autenticado, infra/ops, site de marketing. Auditorias anteriores (`SAAS_PRODUCTION_ROADMAP.md`, `PRIVATE_BETA_READINESS_CHECKLIST.md`, `SAAS_ARCHITECTURE_AUDIT.md`) tinham itens marcados ✅ que não existem no código — este documento é a versão verificada, este é o que manda a partir de agora.

Nada aqui exige infra de escala (sem Kubernetes, sem multi-região). Calibrado pra "vender com confiança pra 5 pessoas", não pra 5.000.

---

## 🔴 P0 — Bloqueia vender pra qualquer pessoa (semana 1)

Cada um destes, se um prospect ou cliente pagante encontrar, mata a venda ou gera reembolso/vergonha.

1. **"Esqueci minha senha" e "Redefinir senha" são fakes.** `recuperar-senha.tsx` e `redefinir-senha.tsx` mostram toast de sucesso sem chamar o Supabase. Ninguém recebe e-mail, ninguém redefine senha. `useAuth.ts` nem tem mais a função (removida em cleanup anterior por zero uso — precisa ser recriada e ligada). `/verificar-email` é uma página vazia (`Hello "/verificar-email"!"`).
2. **Dashboard mostra métrica inventada com a palavra "simulada" no tooltip.** `Dashboard.tsx:322-329` — "Taxa de resposta" é `Math.min(72, 25 + ((won*17+contacted*7) % 40))`, e o tooltip (linha 666) diz literalmente "Taxa simulada de resposta". Cliente pagante passa o mouse e vê a palavra "simulada" no número principal do painel.
3. **Texto "simulado" na primeira tela que um usuário novo vê.** `app.mapa.tsx:66` (estado vazio/home): "Descoberta e enriquecimento simulado de leads." Contradiz o resto do produto, que já roda com dados reais.
4. **Botão "Filtros" morto na sidebar.** `AppSidebar.tsx:200-205` — clica, dispara toast "em breve". Fica ao lado de Ordenar/Exportar que funcionam de verdade; visualmente idêntico, parece bug.
5. **Falha de carregamento é invisível em 4 telas.** Kanban, Hoje, Agenda, Painel (`useLeadsList` sem checar `error`) — se a query falhar, a tela cai no mesmo estado vazio de "você não tem leads ainda". Cliente acha que o produto tá vazio, não que quebrou. `app.mapa.tsx` e `app.historico.tsx` já fazem certo — é inconsistência, não decisão de design.
6. **Bug de segurança: resolução de organização não-determinística no backend.** `_shared/auth.ts:38-44` — `requireAuth()` pega a org do usuário sem `ORDER BY`. Mesma classe de bug já corrigida no frontend (`tenant.ts`) mas não no backend. Mais grave em `delete-account-data/index.ts:18` — delete em cascata irreversível de organização, sem determinismo em quem tem 2+ orgs (o que é o caso comum: toda conta convidada ganha uma Free automática + a convidada).
7. **Sem checkbox de aceite de Termos/Privacidade no cadastro, sem registro de consentimento.** Requisito LGPD básico pra quem vai processar dados pessoais de terceiros (leads).
8. **Política de Privacidade admite publicamente que é modelo.** `privacidade.tsx:131-136`: "Esta Política de Privacidade é um modelo. Recomenda-se revisão por profissional jurídico... antes do lançamento comercial." Qualquer dono de negócio brasileiro que checar isso (cada vez mais comum) vê a confissão. Falta também razão social/CNPJ do controlador.
9. **Zero integração de pagamento.** Nenhum Stripe, nenhum checkout, nenhum webhook — confirmado por grep no repo inteiro. Tela de cadastro com plano pago mostra "Pagamentos não abertos". Stripe completo (checkout + webhook + portal + PIX/boleto) não é realista em 30 dias sem risco. **Caminho pragmático pra 5 clientes:** Stripe Payment Link (~30 min de setup, sem código, aceita PIX/boleto/cartão) ou PIX manual + fatura por e-mail/WhatsApp, com admin virando `subscriptions.status` pra `active` manualmente depois do pagamento confirmar. Full Stripe fica pra depois dos 5 primeiros.

---

## 🟠 P1 — Antes da primeira demo/piloto real (semana 1-2)

10. Sitemap.xml usa domínio placeholder `seudominio.com` em toda URL — quebra indexação/Search Console.
11. OG image é SVG (`og-image.svg`) — WhatsApp/LinkedIn/Facebook antigo não renderizam SVG em preview de link. Precisa fallback PNG (compartilhamento no Brasil é majoritariamente WhatsApp).
12. Link morto: `TestimonialsSection` aponta pra `#fundadores`, mas `FounderOffer` renderiza `null` sem oferta ativa no banco.
13. Footer "Para agências" aponta pra âncora antiga (`/#agencias`) em vez da rota dedicada `/para-agencias`.
14. `error_events` captura erros reais mas ninguém olha — não aparece em lugar nenhum do admin. Precisa de um digest simples (cron → e-mail/webhook) ou não vai saber quando o produto quebrar pra um cliente.
15. Sem monitoramento de uptime — nenhuma ferramenta apontando pro `/health-check/ready` que já existe. UptimeRobot/Better Uptime grátis resolve.
16. Confirmar qual plano do Supabase tá ativo e fazer um teste de restore de verdade — hoje é "não testado" no doc de backup.
17. Confirmar se os Vault secrets do cron `recover-stuck-searches` foram criados em produção (senão o cron roda como no-op silencioso).
18. `app.historico.tsx` usa estado de erro mais pobre (sem botão de retry) que `app.mapa.tsx` — padronizar no componente `ErrorState`.

---

## 🟡 P2 — Pode esperar depois dos 5 clientes

19. Full Stripe (checkout, webhook, portal, PIX/boleto automatizado) — só depois de validar que tem gente disposta a pagar.
20. Engine de entitlements não ligada ao gate real de busca (ainda usa `organizations.monthly_search_limit` antigo) — ok pra 5 clientes controlados manualmente.
21. CI sem CD automatizado / sem smoke test pós-deploy — ok em escala pequena com deploy manual, mas documentar o passo de `curl .../health-check/ready` no runbook pra não pular sob pressão.
22. Headers de segurança HTTP, pequenas exposições de baixo risco (`useTenant()` retorna todas as orgs do próprio usuário, `.eq("organization_id")` ausente em alguns deletes já protegidos por RLS) — defesa em profundidade, não risco real hoje.
23. `docs/COST_CONTROL.md` referencia pesos de score desatualizados (v1) — limpeza de doc.

---

## Achados desta sessão que já foram corrigidos (não precisa refazer)

- ✅ Login e cadastro por e-mail estavam **completamente quebrados** (campo de senha travado em `value=""`, impossível digitar) — corrigido e testado ao vivo no browser.
- ✅ Login com Google configurado e funcionando (Google Cloud Console + Supabase Provider).
- ✅ Lint quebrado em `packages/domain`/`packages/geo` por dependência faltando — corrigido.
- ✅ ~20 arquivos e ~18 funções de código morto removidos; variáveis de ambiente órfãs removidas.

## Pendências de polish de auth (achadas na sessão anterior, ainda não corrigidas)

- Checkbox "Manter conectado" no login é decorativo — Supabase sempre persiste sessão (`persistSession: true` fixo).
- Google Auth: se falhar antes do redirect, formulário inteiro trava desabilitado até recarregar a página (erro não tratado).
- `recuperar-senha`/`redefinir-senha` usam layout (`AuthCard`) visualmente diferente e mais pobre que login/cadastro (`AuthLayout`) — parece produto diferente.
- Essas duas páginas usam `<input type="password">` cru, sem mostrar/ocultar, sem aviso de Caps Lock, sem medidor de força.
- Política de senha inconsistente: cadastro exige 8 caracteres mínimo, redefinir-senha aceita 6.
- Medidor de força do cadastro mostra 4 requisitos visuais mas o schema só valida o comprimento — indicador engana.

---

## Ordem de execução sugerida (semana a semana)

**Semana 1 (02–08/08):** todo o P0. É a única semana onde "quebrado" e "mentindo pro usuário" ainda existem no produto — sai daqui primeiro.
**Semana 2 (09–15/08):** P1 completo + pendências de auth acima. Produto pronto pra primeira demo ao vivo com um prospect real.
**Semana 3 (16–22/08):** primeiras demos/pilotos, ajustar com feedback real, iniciar cobrança manual (PIX/link de pagamento) dos primeiros interessados.
**Semana 4 (23–31/08):** fechar os 5, resolver o que aparecer no uso real, P2 só se sobrar tempo.
