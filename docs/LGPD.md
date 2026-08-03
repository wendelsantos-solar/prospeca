# LGPD — Prospeca

## Natureza dos dados

A plataforma trata prioritariamente **dados empresariais públicos**
(estabelecimentos comerciais: nome, endereço, telefone comercial, website,
avaliações). Ainda assim, telefones e e-mails podem identificar pessoas
físicas (MEI, autônomos) — tratados como dados pessoais.

## Base legal

- Legítimo interesse (prospecção B2B) com minimização de dados.
- Coleta limitada à finalidade comercial: sem CPF, sem dados sensíveis,
  sem dados de menores.

## Direitos do titular — implementação

| Direito              | Mecanismo                                                                             |
| -------------------- | ------------------------------------------------------------------------------------- |
| Exclusão             | Edge Function `delete-account-data` (cascata org completa)                            |
| Correção             | edição de lead na interface                                                           |
| Supressão de contato | `suppression_list` (telefone/e-mail/domínio/estabelecimento, valores em hash SHA-256) |
| Origem do dado       | `leads.source`, `source_search_id`, `provider_fetched_at`                             |
| Auditoria            | `audit_logs` com ação, ator e timestamp                                               |

## Regras operacionais

- Antes de preparar mensagem: consultar `suppression_list`; contato suprimido
  é bloqueado com motivo exibido ao usuário.
- Sem envio automático de mensagens; fluxo assistido com confirmação humana.
- WhatsApp: número celular = apenas `possible`, nunca `verified` sem validação
  por mecanismo permitido.
- Retenção de dados do provedor: TTL de 30 dias (`provider_refresh_after`),
  respeitando a licença do Google.
- Logs sem dados pessoais sensíveis.

## Pendências (antes do lançamento público)

- [ ] Publicar Política de Privacidade e Termos de Uso.
- [ ] Canal de contato do encarregado (DPO).
- [ ] Registro de operações de tratamento (ROPA).
- [ ] Exportação dos dados do usuário (portabilidade) — endpoint dedicado.
