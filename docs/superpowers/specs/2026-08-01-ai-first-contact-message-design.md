# Mensagem de Primeiro Contato por IA — Design

**Date:** 2026-08-01
**Status:** Approved (pending spec review)

## Problem

Feature 3.5 do roadmap (`docs/FEATURE_ROADMAP_2026-08.md`): o primeiro contato
com um lead hoje sai sempre do mesmo template de `{{variáveis}}`
(`message-fill.ts`) — genérico, independente do sinal real do lead (site ruim,
nota caindo, categoria). A cadência de follow-up (`cadence.ts`, roadmap 3.2) já
resolve os toques 2-4 com openers escalonados fixos; o toque 1 (primeiro
contato) continua 100% template.

## Goal

Gerar, sob demanda, uma abertura de primeiro contato específica para aquele
lead a partir dos sinais já coletados (sem site / nota baixa com poucas
avaliações / categoria / cidade), via uma chamada de LLM curta e barata — sem
substituir o template, sem exigir dado que o produto ainda não coleta (3.3/3.4
não implementados).

## Non-Goals

- Substituir o template padrão — IA é opção ao lado dele, nunca automática.
- Cobrir os toques 2-4 da cadência — continuam com os openers fixos de
  `cadence.ts`.
- Diagnóstico de site (3.4) ou sinal de reputação em declínio via re-poll
  (3.3) — usa só os campos que o `Lead` já tem hoje (`rating`, `reviewCount`,
  `hasWebsite`).
- Envio automático — o fluxo continua manual via wa.me, mensagem sempre
  revisável antes de enviar.
- Histórico de conversa / múltiplos turnos — é uma abertura de primeiro
  contato, não um chat.

## Decisions

| Question | Decision |
|---|---|
| Onde a IA roda | Edge function nova `generate-contact-message`, client nunca vê a API key |
| Provider/modelo | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`), via Anthropic Messages API direto (fetch, sem SDK novo), secret `ANTHROPIC_API_KEY` |
| Substitui ou opção | Opção ao lado do template — botão "Gerar com IA", nunca automático/silencioso |
| Sinal insuficiente | Function recusa (`{ ok: false, reason: "insufficient_signal" }`); front cai no template sem mostrar erro — é esperado, não é falha |
| Rate limit | Reusa `assertRateLimit` (`_shared/quota.ts`) — evento `ai_message_generate`, 10/min por organização |
| Cadência | Só toque 1 (primeiro contato, `lead.stage === "new"`); toques 2-4 continuam com openers fixos do `cadence.ts`, sem chamada de IA |
| UI — `PrepareMessageDialog` | Botão "Gerar com IA" (ícone sparkle) ao lado de Copiar/Abrir WhatsApp; sucesso substitui o textarea (`setDraft`); falha só mostra toast discreto, textarea mantém o template |
| UI — `NbaCard` | Para lead novo com canal whatsapp (sem `cadenceStep`), o CTA passa a abrir `PrepareMessageDialog` (em vez de ir direto ao wa.me como hoje) com a geração por IA disparada automaticamente — usuário sempre revisa antes de enviar texto escrito por IA |
| Fallback em qualquer erro (rede, rate limit, API fora) | Silencioso — template já está no textarea, usuário nem percebe que a IA falhou além do toast |

## Signal Sufficiency Heuristic

Calculada na edge function a partir dos campos já existentes em `leads`
(`hasWebsite`, `rating`, `reviewCount`). Suficiente se **qualquer um**:

- `!hasWebsite`
- `rating < 4.0 && reviewCount >= 3`
- `reviewCount === 0 && hasWebsite`

Caso nenhum bata, retorna `insufficient_signal` — nunca gera um texto genérico
fingindo ser específico.

## Prompt

System prompt fixo em PT-BR: tom consultivo, 2-3 frases, proibido inventar
dado que não veio no payload, proibido saudação genérica tipo "Olá, tudo bem?".
Payload por lead: `companyName`, `category`, `city`, `neighborhood`,
`hasWebsite`, `rating`, `reviewCount`. Sem histórico de conversa.

## Architecture

```
apps/web  PrepareMessageDialog / NbaCard
    │  fetch (supabase functions invoke)
    ▼
supabase/functions/generate-contact-message
    │  requireAuth(req)              — mesmo padrão de enrich-lead
    │  load lead (org-scoped)
    │  assertRateLimit(..., "ai_message_generate", 10)
    │  signal check (heurística acima) → early return insufficient_signal
    │  call Anthropic Messages API (Haiku 4.5, ANTHROPIC_API_KEY secret)
    ▼
{ ok: true, message } | { ok: false, reason }
```

Response shape segue o padrão `json()`/`AppError` de `_shared/http.ts`; sem
tabela nova, sem persistência da mensagem gerada (é rascunho de uso único,
igual ao textarea do `PrepareMessageDialog` hoje).

## Testing

- **`message-fill`/`cadence`**: sem mudança de contrato, cobertos pelos testes
  já existentes.
- **Edge function**: sem ambiente Deno local runtime-verificável neste
  checkout (mesmo caveat já documentado em `enrich-lead`) — revisão de código
  cuidadosa no lugar de testes automatizados de integração; heurística de
  sinal é pure function, testável isoladamente.
- **Frontend**: teste unitário da heurística de sinal (se extraída para
  `apps/web` como pure function reusável, ou reimplementada — decidir no plano)
  e dos estados do botão "Gerar com IA" (sucesso substitui draft, falha
  mantém template + toast).
- **E2E manual**: gerar mensagem por IA num lead com sinal (sem site), num
  lead sem sinal suficiente (cai no template), e confirmar que a cadência
  (toques 2-4) não muda de comportamento.
