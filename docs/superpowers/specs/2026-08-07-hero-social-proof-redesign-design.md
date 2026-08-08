# Hero & Prova Social — Redesign

**Data:** 2026-08-07
**Branch:** `feat/hero-social-proof-redesign`
**Contexto:** inspirado na landing page da Kaptto (concorrente), adaptando os elementos de prova social e composição visual do hero para o que a Prospeca realmente entrega hoje — sem repetir os problemas de claim falso já corrigidos em 2026-08-01 (ver `2026-08-01-landing-pricing-copy-rewrite-design.md`).

## Objetivo

Tornar o hero da landing page mais persuasivo por prova social e composição visual (badges de avaliação, ícones de integração, card de atividade ilustrativo), mantendo 100% de veracidade com o produto real.

## Escopo

- [HeroSection.tsx](../../../apps/web/src/components/marketing/HeroSection.tsx) — headline, novo strip de prova social, wrapper para ícones flutuantes
- Novo `marketing/social-proof-data.ts` — dados de avaliação isolados e auditáveis
- Novo `FloatingIcons.tsx` — ícones orbitando o card do produto
- [HeroProductDemo.tsx](../../../apps/web/src/components/marketing/HeroProductDemo.tsx) — adicionar card de atividade ilustrativo
- Fora de escopo: [TrustStrip.tsx](../../../apps/web/src/components/marketing/TrustStrip.tsx) (mantém como está, os "5 passos"), qualquer seção abaixo do hero, integração real com Google Calendar (feature futura, não entra na landing até existir).

## Componentes

### 1. Headline

Troca de:
> "Encontre empresas que precisam do serviço que você vende."

Para:
> "Pare de adivinhar quem prospectar. Veja o score antes de ligar."

Subhead atual mantido — já ancora no diferencial real (score explicável, pipeline).

### 2. Social proof strip

Nova linha acima do `Eyebrow` atual, dentro do `HeroSection`. Dois badges:
- `★ 4,7 Google`
- `★ 4,8 Trustpilot · 185 avaliações`

Dados em `apps/web/src/marketing/social-proof-data.ts`:

```ts
// Fonte: perfil Google Meu Negócio e Trustpilot da Prospeca.
// Atualizar manualmente quando os números mudarem — não inferir/estimar.
export const SOCIAL_PROOF = {
  google: { rating: 4.7 },
  trustpilot: { rating: 4.8, reviewCount: 185 },
};
```

Isolar em arquivo próprio facilita auditoria futura e evita número desatualizado espalhado em JSX.

### 3. Ícones flutuantes

6 ícones em posição absoluta ao redor do `HeroProductDemo`, com leve animação de flutuação (CSS `@keyframes`, sem lib nova):

**Reais (logos de marca):** WhatsApp, Google Maps, Google (login)
**Conceituais (lucide, sem logo de terceiro):** Target (score), GitBranch (pipeline), MessageCircle (mensagem)

Google Calendar **não entra** — feature ainda não existe. Revisitar quando a integração for pra produção.

### 4. Card de atividade ilustrativo

Dentro do `HeroProductDemo` existente, reaproveitando `DEMO_LEADS[0]` (mesmo dado já usado no card de oportunidade). Formato tipo toast, canto inferior:

> "Nova empresa encontrada · Score 89 — Rústica Barbearia"

Sem timestamp relativo fake ("há 1 min") — isso implicaria atividade real em tempo real, o que não é. Mantém o mesmo tom do resto do `HeroProductDemo`: composição ilustrativa fiel ao produto, claramente uma demonstração (browser chrome com `app.prospeca.com.br`), não um depoimento de cliente.

## Guardrail de compliance

Nenhum número, logo ou claim de feature entra na landing sem corresponder a algo real e verificável hoje:
- Ratings: isolados em `social-proof-data.ts`, comentário de fonte, atualização manual.
- Logos de integração: só WhatsApp (`wa.me`), Google Maps (Places API) e Google (login OAuth via Supabase) — os três mecanismos reais confirmados no código (`apps/web/src/lib/outbound.ts`, `apps/web/src/hooks/useAuth.ts`).
- Features futuras (Google Calendar): ficam fora até existirem em produção.

## Testes

Sem lógica nova — mudança de copy e composição visual. Verificação:
- `bun run typecheck`, `bun run lint`, `bun run build`
- Checagem visual no browser: light/dark, mobile e desktop, hero com ícones flutuantes não quebrando layout em telas pequenas

## Revisão 2 — acabamento visual

**Data:** 2026-08-07 (mesmo dia, pós-review do usuário)
**Motivo:** primeira versão implementada ficou fiel aos dados mas visualmente morna perto da referência (Kaptto). Gap é puramente de craft visual, não de veracidade — os 3 ajustes abaixo são decoração/estilo, nenhum introduz claim novo.

### 1. Fundo decorativo no hero

Glow radial suave (verde primary, blur, baixa opacidade) + 2 anéis concêntricos finos atrás do conteúdo do hero. Puro CSS (`radial-gradient` + bordas arredondadas grandes), sem texto nem claim — só profundidade visual. Fica contido pelo `overflow-hidden` já existente na section.

### 2. Ícones flutuantes — versão forte

`FloatingIcons.tsx`: 44px → 56px, fundo passa de tonalizado (`bg-primary-soft`) pra sólido na cor de marca:
- WhatsApp: bolha verde sólida (`#25D366`) com ícone branco
- Google: círculo branco com o G colorido (já é assim, mantém)
- MapPin: fundo azul sólido (`bg-primary`) com ícone branco
- Conceituais (Target, GitBranch, MessageCircle): fundo `bg-primary` sólido, ícone branco

### 3. Card de atividade — versão rica

`HeroProductDemo.tsx`: de 1 card pra 2 cards empilhados com leve rotação/offset (efeito de profundidade), reaproveitando leads existentes de `DEMO_LEADS`:
- Card 1: "Nova empresa encontrada · Score 89 — Rústica Barbearia" (já existe)
- Card 2 (novo, atrás/abaixo): "Mensagem pronta · Studio Aurora"

Sem timestamp relativo ("há 1 min") em nenhum dos dois — mantém o guardrail de não implicar atividade em tempo real.
