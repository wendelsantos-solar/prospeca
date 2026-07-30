# Copy da landing — Radar Local

Referência rápida do texto usado em `/` e `/precos`. A fonte real é o
componente (arquivo indicado) — este doc é pra revisão/tradução, não pra
editar direto (edições aqui não refletem no site).

## Hero (`HeroSection.tsx`)

- Eyebrow: "Inteligência comercial local"
- Headline: "Encontre empresas que precisam exatamente do serviço que
  você vende."
- Subhead: "Pesquise empresas por nicho e região, identifique
  oportunidades com baixa presença digital e organize toda a sua
  prospecção em um só lugar."
- CTAs: "Começar gratuitamente" / "Ver como funciona"
- Microcopy: "Sem cartão de crédito. Configure sua primeira busca em
  poucos minutos."

## Barra de confiança (`TrustStrip.tsx`)

Encontre → Priorize → Aborde → Acompanhe → Converta, cada um com uma
linha de descrição.

## Problema (`ProblemSection.tsx`)

Título: "Prospectar clientes locais não deveria depender de horas no mapa
e planilhas desorganizadas." Comparação "Antes/Depois do Radar Local",
8 itens de cada lado.

## Como funciona (`HowItWorksSection.tsx`)

4 passos: Defina seu público → Descubra oportunidades → Prepare sua
abordagem → Acompanhe até a conversão.

## Oportunidades (`OpportunitySection.tsx`)

Título: "Uma lista de empresas não é suficiente." Card de exemplo:
Rústica Barbearia, Score 89, 5 sinais de oportunidade.

## Score (`ScoreSection.tsx`)

Título: "Saiba por que cada empresa foi priorizada." Exemplo com 82/100 e
7 fatores com pontuação (+25 a +5) — mesmos pesos documentados em
`docs/COST_CONTROL.md` (regra v3.0.0).

## Mapa (`MapSection.tsx`)

Título: "Veja onde estão suas próximas oportunidades." 5 benefícios.

## Pipeline (`PipelineSection.tsx`)

Título: "Da descoberta ao fechamento, sem perder o contexto." Estágios:
Novo, Qualificado, Contatado, Ganho, Descartado.

## Mensagens (`MessagingSection.tsx`)

Título: "Abordagens personalizadas sem começar do zero." Deixa explícito
que o envio é manual — "Você confirma e envia pelo seu WhatsApp — nada
sai sem sua revisão."

## Para quem é (`UseCasesSection.tsx`)

6 casos: Criação de sites, Social media, Tráfego pago, Consultoria,
Software e automação, Agências.

## Para agências (`AgencySection.tsx`, âncora `#agencias`)

Título: "Feito para quem prospecta sozinho. Preparado para quem trabalha
em equipe." 8 recursos em grid.

## Benefícios (`BenefitsSection.tsx`)

6 pares título/descrição: Menos pesquisa manual, Mais prioridade,
Abordagem contextual, Follow-up organizado, Tudo em um lugar, Resultado
mensurável.

## Prova social (`TestimonialsSection.tsx`)

Sem depoimentos reais ainda — texto honesto: "Estamos construindo o Radar
Local junto com profissionais que vendem para negócios locais." CTA:
"Participar do acesso antecipado".

## Estudo de caso (`CaseStudySection.tsx`)

Desligado (`CASE_STUDY_ENABLED = false`) — sem dado real, sem placeholder
fabricado.

## Preços — teaser na home (`PricingTeaser.tsx`) e página completa
(`PricingPage.tsx`)

Título: "Um plano pra cada estágio da sua prospecção." 5 planos —
descrição completa em `docs/PLANS_AND_ENTITLEMENTS.md`. Observação fixa:
"Os limites e valores podem ser ajustados durante o período de acesso
antecipado."

## Oferta fundadores (`FounderOffer.tsx`)

Título: "Faça parte dos primeiros clientes do Radar Local." Só renderiza
com `founder_offer.is_active = true` — sem números inventados.

## FAQ (`FAQSection.tsx`)

16 perguntas do spec original, respostas ajustadas ao comportamento real
do produto (sem envio automático, sem promessa de dado em tempo real,
etc.) — ver arquivo pra texto completo de cada resposta.

## CTA final (`FinalCTA.tsx`)

Título: "Sua próxima oportunidade pode estar a poucos quilômetros de
você." CTA: "Começar gratuitamente" / "Sem cartão de crédito."
