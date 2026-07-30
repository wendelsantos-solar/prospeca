# Incident Response — Radar Local

**Data:** 2026-07-30
**Versão:** 1.0 (beta)

---

## Níveis de severidade

| Nível    | Descrição                        | Exemplo                        | Tempo de resposta |
| -------- | -------------------------------- | ------------------------------ | ----------------- |
| **SEV1** | Produto indisponível             | Site fora do ar, API 100% down | 1h                |
| **SEV2** | Funcionalidade crítica quebrada  | Buscas não funcionam           | 4h                |
| **SEV3** | Funcionalidade parcial degradada | Export lento, mapa não carrega | 24h               |
| **SEV4** | Bug cosmético                    | Erro de tradução, cor errada   | Próximo ciclo     |

---

## Procedimento de resposta

### 1. Detectar

- Alerta do Sentry / monitoramento
- Report do usuário (feedback/suporte)
- Observação do time

### 2. Triar

- Qual a severidade?
- Quantos usuários afetados?
- Há risco de perda de dados?
- Há risco de vazamento de dados?

### 3. Conter

- SEV1/SEV2: Avaliar rollback
- SEV3: Avaliar fix forward
- Se necessário: desabilitar feature via feature flag

### 4. Corrigir

- Criar branch de hotfix
- Testar localmente
- Deploy em staging
- Validar
- Deploy em produção

### 5. Verificar

- Confirmar que o problema foi resolvido
- Verificar se não houve regressão
- Verificar métricas voltaram ao normal

### 6. Comunicar

- SEV1/SEV2: Avisar usuários afetados (e-mail, in-app)
- SEV3: Atualizar status page se disponível
- Interno: Reportar no canal do time

### 7. Post-mortem

- O que aconteceu? (timeline)
- Qual foi a causa raiz?
- O que fizemos bem?
- O que podemos melhorar?
- Criar tasks de prevenção

---

## Cenários comuns

### Buscas pararam de funcionar (SEV2)

1. Verificar Google Places API quota
2. Verificar logs do `execute-search`
3. Verificar se há buscas stuck (admin panel)
4. Se quota: aumentar temporariamente ou notificar Google
5. Se bug: hotfix

### Aumento anormal de custo Google (SEV2)

1. Verificar admin panel → custo por organização
2. Identificar organização com consumo anormal
3. Verificar se há loop de busca ou force refresh excessivo
4. Aplicar budget cap se necessário
5. Contatar o usuário

### Vazamento de dados entre tenants (SEV1)

1. **Parar imediatamente** todas as edge functions
2. Identificar escopo (quais usuários, quais dados)
3. Corrigir RLS / query
4. Notificar afetados (LGPD)
5. Post-mortem obrigatório

### Banco indisponível (SEV1)

1. Verificar Supabase status page
2. Se manutenção planejada: comunicar
3. Se incidente: acionar restore se necessário
4. Ver `BACKUP_AND_RECOVERY.md`

---

## Contatos de emergência

| Papel     | Nome | Contato |
| --------- | ---- | ------- |
| Tech Lead | —    | —       |
| Founder   | —    | —       |
| DevOps    | —    | —       |

_(Preencher antes do beta)_

---

## Recursos

- Supabase Status: https://status.supabase.com
- Google Cloud Status: https://status.cloud.google.com
- Sentry Dashboard: (configurar)
- Logs: Supabase Dashboard → Edge Functions → Logs
