# Backup and Recovery — Radar Local

**Data:** 2026-07-30
**Versão:** 1.0

---

## Responsabilidade

O Supabase gerencia backups automáticos do banco de dados dependendo do plano:

| Plano Supabase | Backup      | Retenção    | Point-in-time recovery |
| -------------- | ----------- | ----------- | ---------------------- |
| Free           | Diário      | 7 dias      | ❌                     |
| Pro            | Diário      | 14 dias     | ✅ (7 dias)            |
| Team           | Diário      | 30 dias     | ✅ (14 dias)           |
| Enterprise     | Customizado | Customizado | ✅                     |

**Verificar:** Qual plano Supabase está ativo para produção?

---

## Estratégia de backup

### O que precisa de backup

| Recurso                 | Backup                         | Notas                       |
| ----------------------- | ------------------------------ | --------------------------- |
| PostgreSQL database     | Supabase managed               | Inclui schema + dados       |
| Auth users              | Supabase managed (auth schema) | Incluído no backup do banco |
| Storage (arquivos)      | Supabase managed               | Se buckets estiverem em uso |
| Edge Functions (código) | Git repository                 | Código fonte versionado     |
| Migrations              | Git repository                 | `supabase/migrations/`      |

### O que NÃO está no backup automático

| Recurso                               | Mitigação                     |
| ------------------------------------- | ----------------------------- |
| Configurações do Supabase (auth, api) | `config.toml` versionado      |
| Secrets (API keys, service role)      | Documentados, não versionados |
| Configuração de domínio/DNS           | Gerenciado fora do Supabase   |
| Logs                                  | Retenção limitada no Supabase |

---

## Procedimento de restore

### Restore via Supabase Dashboard

1. Acessar Supabase Dashboard → Database → Backups
2. Selecionar o backup desejado
3. Clicar "Restore"
4. Confirmar (o restore substitui o banco atual!)

**Atenção:** O restore é destrutivo — sobrescreve o banco atual.
Não há restore parcial por tabela.

### Restore manual (point-in-time recovery - plano Pro+)

1. Acessar Supabase Dashboard → Database → Backups
2. Selecionar PITR (point-in-time recovery)
3. Escolher o timestamp desejado
4. Restaurar para um novo banco (não sobrescreve o atual)
5. Verificar dados
6. Migrar dados se necessário

### Rollback de migration

1. Identificar a migration problemática
2. Criar nova migration que reverte as mudanças
3. Testar em staging
4. Aplicar em produção

---

## Procedimento de teste de restore

### Frequência: Trimestral (ou antes de eventos críticos como beta launch)

1. Criar um projeto Supabase temporário
2. Restaurar o backup mais recente
3. Verificar:
   - [ ] Schema completo (todas as tabelas)
   - [ ] Dados de organizações de teste
   - [ ] Auth users podem fazer login
   - [ ] RLS está ativo
   - [ ] Edge functions funcionam
4. Documentar resultado e tempo de restore

---

## RPO e RTO

| Métrica                        | Valor alvo                         | Realidade atual          |
| ------------------------------ | ---------------------------------- | ------------------------ |
| RPO (Recovery Point Objective) | 24h (máx. 1 dia de dados perdidos) | Backup diário (Supabase) |
| RTO (Recovery Time Objective)  | 4h (máx. 4h para restaurar)        | Não testado              |

---

## Prevenção de perda de dados

### Salvaguardas existentes

1. **Migrations versionadas:** Todo schema change é código (`supabase/migrations/`)
2. **Foreign keys:** Integridade referencial
3. **Soft delete:** Triggers `set_updated_at()` nas tabelas principais
4. **Idempotência:** `idempotency_keys` previnem duplicação em retries
5. **Cascades controlados:** `ON DELETE CASCADE` nas relações corretas

### Salvaguardas recomendadas

1. **Export periódico:** Export mensal dos dados críticos para storage externo (S3, GCS)
2. **Database dump manual:** `pg_dump` semanal como backup adicional
3. **Teste de restore regular:** Trimestral

---

## Checklist de emergência

### Em caso de perda de dados:

1. [ ] **Não panicar** — não fazer mudanças adicionais no banco
2. [ ] **Identificar o escopo:** Quais tabelas? Qual período? Qual causa?
3. [ ] **Verificar backups:** Qual é o backup mais recente antes do incidente?
4. [ ] **Decidir abordagem:** Restore completo ou PITR?
5. [ ] **Comunicar:** Avisar usuários afetados se dados foram perdidos
6. [ ] **Restaurar:** Seguir procedimento de restore
7. [ ] **Verificar:** Testar fluxos principais após restore
8. [ ] **Post-mortem:** Documentar causa e prevenir recorrência

---

## Responsabilidades

| Responsável        | Ação                                                       |
| ------------------ | ---------------------------------------------------------- |
| DevOps / Tech Lead | Verificar plano Supabase, configurar backup                |
| DevOps / Tech Lead | Realizar teste de restore trimestral                       |
| Tech Lead          | Documentar qualquer mudança no procedimento                |
| Time               | Reportar qualquer suspeita de perda de dados imediatamente |
