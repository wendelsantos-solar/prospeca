# Pesquisa competitiva — Prospeca

**Data de acesso às fontes:** 01/08/2026  
**Escopo:** descoberta de negócios locais, dados e enriquecimento, priorização, prospecção, WhatsApp e CRM.  
**Janela de decisão:** vender os primeiros clientes em 30 dias.

## Resumo executivo

O Prospeca não deve tentar virar um novo HighLevel, RD Station ou Agendor em 30 dias. A melhor posição é mais estreita e mais demonstrável:

> **Encontrar negócios locais com um motivo verificável para abordar, preparar a conversa e garantir o próximo passo.**

O produto já tem a espinha dorsal dessa promessa: busca via Google Places, score explicável, mapa, importação para pipeline, cadência assistida, próxima melhor ação e mensagem inicial por IA revisada pelo usuário. A evidência está no cliente oficial do [Google Places](../supabase/functions/_shared/google.ts), nas [regras do score](../packages/domain/src/score.ts), no [pipeline de descoberta](../supabase/functions/_shared/search-pipeline.ts), na [importação para o funil](../supabase/functions/import-search-results/index.ts), na [cadência D+2/D+4/D+7/D+14](../apps/web/src/lib/cadence.ts), na [mensagem por IA baseada em sinais reais](../supabase/functions/_shared/ai-message.ts) e no [gate de WhatsApp com opt-out](../apps/web/src/lib/outbound.ts).

A pesquisa oficial mostra, porém, que **descoberta local não é exclusividade**. Prospek já anuncia Google Maps + Receita + agentes + WhatsApp + Kanban; Prospex oferece Maps + score de saúde digital + mensagem de WhatsApp; LeadScout combina Google/Places + Kanban + proposta por IA em modelo pay-as-you-go; LeadSwift faz a versão global com sinais de site e outreach por e-mail. O diferencial sustentável do Prospeca precisa ser a experiência brasileira e orientada a ação: sinais confiáveis, abordagem revisável, acompanhamento do próximo passo e prova de resultado — não volume de registros.

Para a meta de 30 dias, as prioridades são:

1. resolver o gate de uso dos dados do Places e de opt-in do WhatsApp antes do piloto pago;
2. empacotar o produto para um ICP único e uma oferta fundadora paga;
3. tornar o “por que abordar esta empresa” impossível de perder dentro do produto;
4. fechar o ciclo `descoberta → contato permitido → resposta → reunião → ganho` com métricas;
5. validar a cadência assistida já existente com usuários reais;
6. adiar WhatsApp automático, white-label completo e uma suíte CRM ampla até haver receita e evidência de uso.

## Método e limites

- Foram usadas apenas fontes de primeira parte: páginas oficiais de produto/preço, documentação oficial, APIs públicas do próprio fornecedor e cases publicados pelo fornecedor.
- Nenhuma comparação ou número de site de review, blog afiliado ou agregador foi usado como evidência.
- Números de adoção e resultados são **declarações dos próprios fornecedores ou clientes em cases hospedados pelo fornecedor**. Provam operação comercial e casos de valor, mas não constituem auditoria independente.
- Quando uma capacidade não aparece nas fontes oficiais consultadas, o texto diz “não encontrei evidência pública”; não presume que tecnicamente não exista.
- Preços são os exibidos nas fontes na data de acesso, sem conversão cambial. Impostos, consumo de mensagens/dados, add-ons e negociação comercial podem alterar o custo final.

### Restrições oficiais que mudam o roadmap

**WhatsApp/Meta — fato.** A política oficial permite contato somente quando a empresa recebeu o número **e** um opt-in que confirme o desejo de receber mensagens ou chamadas. Na Business Platform, conversas iniciadas pela empresa exigem template aprovado; fora da janela de atendimento de 24 horas, somente templates aprovados podem ser enviados. A política também exige respeitar opt-out e prevê limitação/remoção de acesso para envio não autorizado em escala ([WhatsApp Business Messaging Policy](https://business.whatsapp.com/policy)). Portanto, um telefone público encontrado no Maps, isoladamente, não satisfaz o requisito de opt-in da Meta.

**Google Maps/Places — fato.** Os termos da Google Maps Platform vedam exportar, extrair ou fazer scraping de Maps Content para uso fora dos Serviços e citam como exemplos salvar nomes, endereços/reviews e fazer bulk download de places information. O conteúdo não pode ser armazenado em cache salvo exceção expressa; a política da Places API permite guardar `place_id` indefinidamente e exige atribuição apropriada ([termos](https://cloud.google.com/maps-platform/terms), [política Places](https://developers.google.com/maps/documentation/places/web-service/policies)). Alegações de concorrentes como “API oficial + CSV” não provam conformidade.

**Implicação, não parecer jurídico.** O desenho de persistência, score, exibição e exportação do Radar deve passar por revisão específica dos termos/licenciamento e por revisão jurídica brasileira. Em 30 dias, envio humano revisável, opt-out e atribuição clara são mais seguros que cold WhatsApp automático; não se deve prometer que o simples uso de dado público torna a abordagem automaticamente compatível com Meta, Google ou LGPD.

## 1. Mercado em uma página

### 1.1 Concorrentes mais próximos da jornada do Radar

| Produto            | Fatos verificados                                                                                                                                                                                                                                  | Preço público e prova de operação                                                                                                                                                                                          | Leitura para o Radar                                                                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Prospek (BR)**   | Busca Google Maps por nicho/cidade, base da Receita por CNAE/estado, empresas novas, contatos e sócios; anuncia agentes de e-mail, follow-up, WhatsApp em massa, inbox, Kanban, analytics, webhooks e CSV ([produto](https://www.prospek.com.br/)) | Starter **R$ 39,90/mês** ou R$ 297/ano; Pro **R$ 79,90/mês** ([preços oficiais](https://www.prospek.com.br/precos)). A empresa declara 27,8 mi de empresas mapeadas, mas não foi localizado case quantitativo identificado | É o confronto brasileiro de breadth. Radar não sustenta prêmio por “Maps + pipeline” sozinho; precisa demonstrar confiança do score, clareza e melhor workflow humano |
| **Prospex (BR)**   | Extrai até 60 negócios por busca, enriquece redes/tech/velocidade, calcula Digital Health Score em cinco dimensões, exporta Excel e gera mensagem de WhatsApp ([produto](https://www.prospex.app.br/))                                             | **R$ 97/mês**, trial de 20 leads/7 dias sem cartão. A página declara 5 mil+ leads e 87% de precisão, sem metodologia auditável ou cases identificados                                                                      | É o competidor de tese mais próximo: Maps → score → mensagem. Radar precisa vencer em explicabilidade, acompanhamento e evidência real de resultado                   |
| **LeadScout (BR)** | Google Maps/Places, Excel/manual, Kanban, proposta com IA, dashboard de conversão/valor e PWA ([produto](https://leadscout.com.br/))                                                                                                               | Sem mensalidade: **R$ 0,15/lead via Google Maps API**, R$ 0,04 manual/Excel, R$ 0,49 por proposta; recarga mínima R$ 20 e R$ 11 de teste. Não foi localizado case quantitativo oficial                                     | Torna o lead bruto e o Kanban baratos. A unidade de valor do Radar deve ser oportunidade priorizada/trabalhada, não importação                                        |

Esses três foram escolhidos como comparáveis diretos brasileiros. LeadSwift, Outscraper e LeadForge aparecem na matriz ampliada porque isolam, respectivamente, o fluxo local global, o dado bruto e a operação de WhatsApp.

| Produto            | ICP e modelo de valor                                                               | Descoberta / dados                                                                                                                                                          | Execução e CRM                                                                                                               | Preço público observado                                                                                                                                                                                                                                                                           | Evidência oficial de operação e valor                                                                                                                                                                                                                                                                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **HighLevel**      | Agências que querem consolidar e revender uma plataforma sob sua marca              | Captura de leads por sites, funnels, formulários e chat; não encontrei descoberta de negócios por Google Maps nas páginas consultadas                                       | CRM, pipeline, automação, agenda, reputação, pagamentos, comunicação multicanal e white-label                                | Starter **US$ 97/mês**, Unlimited **US$ 297/mês** e Agency Pro/SaaS **US$ 497/mês** ([white-label e preços](https://www.gohighlevel.com/white-label-crm), [Agency Pro](https://help.gohighlevel.com/support/solutions/articles/48001180534-how-to-upgrade-to-the-agency-pro-plan-497-saas-plan-)) | A empresa declara mais de **60 mil clientes** e **US$ 1 bi em receita** em 2023, além de 2,3 bilhões de leads geridos em 2024 ([história oficial](https://www.gohighlevel.com/about-us)); um case relata quase 300 clientes pagantes e US$ 375 mil de receita bruta em um SaaS vertical construído sobre HighLevel ([LeadEngage](https://www.gohighlevel.com/case-studies/lead-engage)) |
| **RD Station CRM** | Times comerciais brasileiros e agências que precisam organizar e automatizar vendas | Oportunidades entram manualmente ou por integrações; não encontrei busca nativa de empresas locais nas páginas consultadas                                                  | Funil, tarefas, follow-up, WhatsApp Web, histórico, automações, relatórios e IA de priorização                               | Free para até 4 usuários; Basic **R$ 73/usuário/mês** no anual; Pro **R$ 131/usuário/mês** no anual, mínimo de 4; Advanced sob consulta ([planos](https://www.rdstation.com/planos/crm/))                                                                                                         | A RD declara mais de **20 mil empresas** no CRM ([solução para agências](https://www.rdstation.com/produtos/crm/solucoes/para-agencia-de-marketing/)); a Agência 8D relata 95% da meta anual em oito meses e 40% de economia de tempo ([case oficial](https://www.rdstation.com/historias-de-sucesso/8d/))                                                                              |
| **Agendor**        | PMEs e times de vendas consultivas B2B, especialmente operações externas            | Oferece geração de leads via Speedio e mapa de clientes; não encontrei descoberta própria baseada em Google Places                                                          | CRM, funil, tarefas, automações, app/offline, geolocalização de visitas, WhatsApp Sync e telefonia                           | Gratuito até 3 usuários; Pro **R$ 59/usuário/mês**; Performance **R$ 83/usuário/mês**; Corporativo **R$ 156/usuário/mês**, mínimo de 10 ([planos](https://www.agendor.com.br/planos-precos))                                                                                                      | A empresa declara milhares de clientes e mais de 4 mil avaliações; cases na página oficial relatam redução de ciclo de 90 para 30 dias e de 18 meses para 6–8 meses ([clientes](https://www.agendor.com.br/clientes))                                                                                                                                                                   |
| **Econodata**      | Times brasileiros de inteligência comercial, pré-vendas e outbound B2B              | Base e segmentação de empresas/decisores, dados firmográficos e contatos                                                                                                    | Pesquisa, listas, tags e apoio à prospecção; não encontrei um CRM de fechamento equivalente ao Radar nas páginas consultadas | Sem preço público; venda assistida por especialista ([plataforma](https://prospecte.econodata.com.br/plataforma-de-prospeccao))                                                                                                                                                                   | A empresa declara **27 mi de empresas ativas**, 4,3 mi de decisores e 1,9 mi de empresas com telefones assertivos ([site oficial](https://www.econodata.com.br/)); a Gulgielmin relata 33% de aumento de vendas no primeiro mês e ao menos 90% de assertividade nos dados ([case oficial](https://www.econodata.com.br/blog/case-gulgielmin-uniformes))                                 |
| **Apollo**         | Times globais de SDR/outbound que querem dados e engagement no mesmo produto        | Base declarada de mais de **240 mi de pessoas** e 30 mi de empresas, filtros, enriquecimento e scoring ([produto para marketing](https://www.apollo.io/personas/marketers)) | Sequências, A/B tests, ligações, follow-up automático, pipeline e integrações                                                | No faturamento anual: Free; Basic **US$ 49/usuário/mês**; Professional **US$ 79/usuário/mês**; Organization **US$ 119/usuário/mês**, mínimo 3 ([tabela oficial 2026](https://www.apollo.io/insights/best-prospecting-tool-with-flexible-pricing), [preços](https://www.apollo.io/pricing))        | A Apollo declara uso em mais de **600 mil empresas** ([Apollo Anywhere](https://www.apollo.io/anywhere)); a Customer.io relata 70% mais SQLs depois da implementação ([case oficial](https://www.apollo.io/magazine/customerio-customer-story))                                                                                                                                         |
| **Clay**           | Growth/GTM engineering que precisa combinar vários provedores, sinais e IA          | Marketplace com mais de 150 parceiros, waterfalls, sinais e agentes de pesquisa/qualificação                                                                                | Orquestração, enriquecimento de CRM, scoring e personalização; sequencer de e-mail                                           | Free; Launch **US$ 185/mês** e Growth **US$ 495/mês**; equivalentes anuais exibidos desde US$ 167/446 por mês. Consumo também depende de ações/créditos ([preços](https://www.clay.com/pricing))                                                                                                  | A Pump relata +30% em reuniões, +25% de receita por vendedor e ramp 6x mais rápido ([case oficial](https://www.clay.com/customers/pump)); a Hex relata +50% no win rate de contas identificadas por sinal de visita ([case oficial](https://www.clay.com/customers/hex))                                                                                                                |
| **LeadSwift**      | Agências e prestadores que prospectam empresas locais                               | Busca fresca em mapas/diretórios, contatos, ratings/reviews, tecnologia, sinais de SEO e conteúdo do site                                                                   | Personalização por IA, sequências, A/B tests, rotação de remetentes, follow-up por evento e inbox de e-mail                  | Starter **US$ 24,99/mês**, Professional **US$ 49,99/mês**, Agency **US$ 99,99/mês**; no anual, US$ 19,99/39,99/79,99 por mês ([preços](https://leadswift.com/pricing))                                                                                                                            | A empresa declara mais de **40 mil usuários** e publica depoimentos com resultados atribuídos ao produto ([produto](https://leadswift.com/), [depoimentos](https://leadswift.com/reviews)); são alegações first-party, não auditadas                                                                                                                                                    |
| **Outscraper**     | Usuários técnicos, agências e operações de dados que querem extração em volume      | Google Maps, reviews, contatos e outras fontes, com API e exportação                                                                                                        | Não é apresentado como CRM; entrega dados para o fluxo do cliente                                                            | Google Maps: primeiros 500 lugares grátis; **US$ 3/1.000** do registro 501 ao 100 mil; **US$ 1/1.000** acima de 100 mil ([preços](https://outscraper.com/pricing/))                                                                                                                               | A empresa declara milhares de clientes; um depoimento relata extração de mais de 120 mil localizações em 12 meses ([sobre/clientes](https://outscraper.com/about-us/))                                                                                                                                                                                                                  |
| **LeadForge**      | Negócios e equipes brasileiras cujo processo comercial ocorre no WhatsApp           | Importa e organiza leads; não encontrei descoberta de empresas locais na oferta pública                                                                                     | WhatsApp por QR ou API oficial, funil, automações, follow-up, multiusuário, relatórios e chatbot                             | Free; Basic **R$ 69/mês**; Advanced **R$ 147/mês**; Pro **R$ 297/mês**, conforme a [API pública oficial de planos](https://api.leadforge.com.br/api/plans)                                                                                                                                        | A página oficial declara mais de **2.500 empresas**, trial de 7 dias e resultados de clientes; as métricas são autopublicadas e não auditadas ([site oficial](https://www.leadforge.com.br/))                                                                                                                                                                                           |

## 2. Leitura por concorrente

### 2.1 HighLevel: referência de plataforma para agência, não alvo de paridade

**Fatos verificados.** HighLevel combina CRM, funnels, sites, agendamento, automação, reputação, comunicação, analytics e white-label; no plano Pro, a agência pode operar SaaS Mode. A própria empresa vende a capacidade de reempacotar o software e cobrar o cliente final ([white-label](https://www.gohighlevel.com/white-label-crm), [CRM para agências](https://www.gohighlevel.com/crm)). Cases oficiais mostram que a especialização por nicho e uma dor inicial estreita podem sustentar produtos revendidos: LeadEngage começou resolvendo mensagens e automação para usuários de Follow Up Boss antes de ampliar a oferta ([case](https://www.gohighlevel.com/case-studies/lead-engage)).

**Inferência para o Prospeca.** O aprendizado não é copiar vinte módulos. É escolher uma dor inicial clara, entregar valor rapidamente e deixar a suíte maior para depois. HighLevel é ameaça quando o cliente já tem leads e quer automatizar todo o negócio; não resolve, nas páginas pesquisadas, a descoberta orientada por sinais de negócios locais.

### 2.2 RD Station CRM: o benchmark brasileiro de follow-up e adoção simples

**Fatos verificados.** O plano gratuito inclui funil, lembretes, WhatsApp Web, e-mail e histórico; os planos superiores acrescentam times, relatórios, automações, áudios do WhatsApp e sugestões de tarefas por IA ([planos](https://www.rdstation.com/planos/crm/)). Na descrição oficial do gratuito, a oportunidade é criada manualmente ou por integração, e a extensão salva conversas do WhatsApp no histórico ([plano gratuito](https://www.rdstation.com/planos/crm/gratuito/)).

**Inferência para o Prospeca.** RD torna difícil vender “Kanban + lembrete” isoladamente, porque isso já é grátis. O argumento comercial do Radar precisa começar antes do CRM: **quem abordar, por quê e com qual abertura**. A cadência assistida existente deve parecer continuação natural da descoberta, não mais um CRM genérico.

### 2.3 Agendor: prova de que geografia e operação de campo têm valor no Brasil

**Fatos verificados.** O Agendor inclui mapa de clientes por geolocalização, cadastro offline, fluxos inteligentes e app móvel em todos os planos, além de extensão de WhatsApp; sua oferta também lista tarefas de visita e geração de leads via Speedio ([planos](https://www.agendor.com.br/planos-precos), [produto](https://www.agendor.com.br/)).

**Inferência para o Prospeca.** Rota de visita pode ser uma extensão forte, mas somente se os primeiros compradores forem vendedores externos, representantes ou prestadores porta a porta. Para agências digitais, um diagnóstico legível e uma abordagem melhor provavelmente têm valor mais imediato que otimização de rota.

### 2.4 Econodata: profundidade cadastral brasileira, mas outra unidade de valor

**Fatos verificados.** Econodata vende mapeamento de mercado, definição de ICP, filtros firmográficos, decisores e contatos em escala nacional ([site oficial](https://www.econodata.com.br/), [plataforma](https://prospecte.econodata.com.br/plataforma-de-prospeccao)). O preço não é publicado; o funil é assistido por especialista.

**Inferência para o Prospeca.** Competir em número de empresas, quadro societário ou profundidade cadastral exigiria dados e capital que não ajudam a venda em 30 dias. Radar deve usar sinais visíveis e acionáveis para quem vende serviço local: ausência de site real, reputação, quantidade de avaliações, proximidade e contato disponível.

### 2.5 Apollo: dado + cadência + medição no mesmo fluxo

**Fatos verificados.** Apollo junta base de contatos, pesquisa, sequencing, testes, chamadas, follow-up e pipeline. A própria página de preços descreve uma sequência repetível de prospecção e fechamento; campanhas de e-mail estão presentes até no plano gratuito, com restrições de provedor ([preços](https://www.apollo.io/pricing)). O case da Customer.io atribui 70% mais SQLs ao uso combinado de dados, playbooks, sequências e testes ([case](https://www.apollo.io/magazine/customerio-customer-story)).

**Inferência para o Prospeca.** A lacuna relevante não é copiar e-mail em massa. É medir os estágios entre lead encontrado e venda e aprender quais sinais/aberturas geram resposta. Sem esse retorno, o score continua uma regra estática; com ele, pode ser calibrado para o ICP brasileiro.

### 2.6 Clay: o benchmark de sinais customizados e explicabilidade

**Fatos verificados.** Claygent pesquisa sinais sob medida, qualifica leads, escreve outbound e mostra rastros de decisão; a plataforma combina mais de 150 provedores e permite trazer chaves próprias ([Claygent](https://www.clay.com/claygent), [preços](https://www.clay.com/pricing)). A Hex relata que sinais mais ricos e alertas rápidos elevaram o win rate em 50%; a Pump relata que ICP codificado e listas prontas reduziram o ramp de vendedores de 90 para 14 dias ([Hex](https://www.clay.com/customers/hex), [Pump](https://www.clay.com/customers/pump)).

**Inferência para o Prospeca.** O score deve funcionar como uma explicação de venda, não como um número decorativo. Cada lead precisa responder: “qual sinal foi observado?”, “por que isso pode indicar oportunidade?” e “qual ação é recomendada?”. O Radar pode entregar essa clareza com poucos sinais confiáveis, sem replicar a infraestrutura do Clay.

### 2.7 LeadSwift: concorrente funcional mais próximo

**Fatos verificados.** LeadSwift parte de empresas locais encontradas em mapas/diretórios, enriquece com decisores, e-mails, ratings, reviews, tecnologia, SEO e conteúdo de site; depois oferece outreach por e-mail com IA, sequências, A/B tests e follow-up por evento ([produto](https://leadswift.com/)). Todos os planos oferecem leads, contatos, exportações, dados e outreach ilimitados; o limite comercial principal é buscas por dia ([preços](https://leadswift.com/pricing)). Também há integrações oficiais com n8n, Clay, Zapier e HighLevel ([integrações](https://leadswift.com/integrations)).

**Inferência para o Prospeca.** “Encontramos empresas no mapa” não basta como posicionamento. A vantagem defensável é ser mais direto para o Brasil: português, canais permitidos, regras e consentimento claros, score explicável, pipeline leve e onboarding sem configuração de infraestrutura de e-mail. A maior lacuna frente ao LeadSwift é um **diagnóstico mais rico e acionável**; a maior oportunidade é evitar a complexidade do concorrente.

### 2.8 Outscraper: o substituto barato de dados brutos

**Fatos verificados.** Outscraper cobra por registro, permite exportação e API e cobre Google Maps, reviews e enriquecimentos ([preços](https://outscraper.com/pricing/)). Sua proposta é acesso simples e confiável a dados públicos, não execução comercial completa ([sobre](https://outscraper.com/about-us/)).

**Inferência para o Prospeca.** O cliente que só quer um CSV pode comparar o Radar com centavos por registro. Não vale entrar nessa guerra. A unidade de valor do Radar deve ser **oportunidade trabalhada** ou **conversa iniciada**, não lead exportado.

### 2.9 LeadForge: referência brasileira de WhatsApp depois da descoberta

**Fatos verificados.** LeadForge centraliza conversas, funil, follow-ups automáticos, relatórios, chatbot e equipe; oferece conexão via QR e API oficial Meta ([site](https://www.leadforge.com.br/)). A API pública lista planos pagos e limites de usuários/leads ([planos](https://api.leadforge.com.br/api/plans)).

**Inferência para o Prospeca.** LeadForge mostra que existe disposição a pagar pela etapa posterior ao lead. Em 30 dias, Radar não precisa construir inbox nem API oficial; pode ganhar entregando a oportunidade qualificada e a próxima ação permitida, e integrar/conviver com um CRM de WhatsApp quando o cliente já tiver opt-in e amadurecer.

## 3. Posição competitiva recomendada

### Fatos do produto atual

- A busca usa Google Places API (New), com texto/proximidade e campos como site, telefone, nota, volume de avaliações e URI do Maps ([cliente Google](../supabase/functions/_shared/google.ts)).
- O score é determinístico e versionado; usa sinais como ausência de site, nota baixa, poucas avaliações, canais de contato e distância ([score](../packages/domain/src/score.ts), [normalização de entrada](../packages/domain/src/score-input.ts)).
- Descoberta e CRM são separados: o usuário vê resultados ordenados e escolhe o que importar para o funil ([rota do mapa](../apps/web/src/routes/app.mapa.tsx), [importação](../supabase/functions/import-search-results/index.ts)).
- O primeiro contato pode ser escrito por IA somente quando existe sinal suficiente; o usuário revisa e o sistema abre `wa.me`, sem envio automático ([heurística de IA](../supabase/functions/_shared/ai-message.ts), [composer](../apps/web/src/components/app/PrepareMessageDialog.tsx)).
- O fluxo de WhatsApp bloqueia opt-out e evita tratar telefone fixo como WhatsApp ([outbound](../apps/web/src/lib/outbound.ts)).
- Esse gate não registra nem exige opt-in antes de abrir `wa.me`; bloquear opt-out não satisfaz a política da Meta para iniciar contato ([outbound atual](../apps/web/src/lib/outbound.ts), [política oficial](https://business.whatsapp.com/policy)).
- Já existe cadência assistida de quatro toques e uma tela “Hoje” que promove ações vencidas/próximas ([cadência](../apps/web/src/lib/cadence.ts), [agrupamento diário](../apps/web/src/lib/today.ts)).

### Inferência de posicionamento

**Categoria a vender:** inteligência de prospecção local com execução assistida.  
**Não vender como:** “CRM completo”, “scraper do Google Maps” ou “automação de WhatsApp”.  
**ICP inicial recomendado:** agências pequenas, freelancers e prestadores que vendem criação de sites, marketing, SEO local, reputação ou automação para negócios locais e ainda prospectam manualmente pelo Google Maps/WhatsApp.  
**Job-to-be-done:** “Em menos de 15 minutos, sair de uma região/nicho para uma lista priorizada e iniciar uma abordagem específica, sem perder o follow-up.”

Esse ICP percebe imediatamente os sinais já disponíveis, usa WhatsApp e pode fechar um cliente cujo ticket paga vários meses da ferramenta. É também o segmento ao qual LeadSwift e os cases verticais do HighLevel demonstram apelo, embora por fluxos mais amplos ou centrados em e-mail.

### Diferenciação que cabe no produto

1. **Brasil por padrão:** idioma, telefone, WhatsApp, bairros/cidades e conformidade operacional.
2. **Sinal antes da lista:** explicar por que vale abordar, não apenas fornecer contato.
3. **Ação humana assistida:** IA prepara; o vendedor revisa; nada é disparado silenciosamente.
4. **Continuidade simples:** cada oportunidade tem próximo passo, prazo e resultado.
5. **Aprendizado por resultado:** o score deve evoluir a partir de resposta/reunião/ganho por nicho, depois que houver dados suficientes.

## 4. O que implementar para vender em 30 dias

As recomendações abaixo são **inferências priorizadas**, não fatos de mercado. O critério é impacto na venda dos primeiros cinco clientes, aproveitamento do código existente e risco de execução.

### P0 — dias 1 a 7: transformar capacidades em uma oferta comprável

#### 1. Gate de consentimento e uso de dados antes do piloto

Antes de vender, obter revisão específica do desenho de Places e impedir que um número apenas descoberto no Maps seja tratado como WhatsApp autorizado. O produto precisa registrar `consent_status`, origem, data e escopo; sem opt-in compatível com a política da Meta, a próxima ação deve ser outro canal permitido ou “obter consentimento”, não abrir WhatsApp. A revisão humana da mensagem continua útil, mas não substitui opt-in.

Revisar também quais campos do Places podem ser exibidos, persistidos, usados para derivar score e exportados. A implementação deve preservar atribuição e retenção permitidas; concorrentes anunciarem exportação não reduz o risco do Radar.

**Critério de pronto:** parecer/revisão documentada para o fluxo específico; nenhum CTA inicia WhatsApp sem consentimento registrado; UI informa origem/limite do dado e respeita opt-out.

#### 2. Uma oferta fundadora, um ICP, um resultado

Para os primeiros cinco clientes, vender uma oferta só: o plano **Profissional já documentado a R$ 119/mês por organização, com 2.000 leads/mês**, onboarding guiado, 7 dias de piloto assistido, sem contrato e cobrança manual no primeiro mês ([planos atuais do Radar](./PLANS_AND_ENTITLEMENTS.md)). Não criar uma quarta faixa de preço para o piloto.

O preço é plausível, mas precisa de prova: o Radar Solo a R$ 59 fica entre [Prospek Starter](https://www.prospek.com.br/precos) (R$ 39,90) e [PuxaLeads Básico](https://puxaleads.com.br/) (R$ 67); o Profissional a R$ 119 é mais caro que [Prospek Pro](https://www.prospek.com.br/precos) (R$ 79,90) e [Prospex](https://www.prospex.app.br/) (R$ 97), ambos com alegações de automação/análise mais ampla. Não baixar automaticamente. Justificar o prêmio com score confiável, contexto, pipeline, follow-up e onboarding; se prospects valorizarem apenas volume, o posicionamento falhou.

**Critério de pronto:** cinco prospects entendem a promessa em uma frase; pelo menos três completam uma busca real durante a demonstração; ao menos um aceita pagar ou explica uma objeção concreta de valor/preço.

#### 3. Evidência de oportunidade visível e acionável

Transformar o `score_breakdown` já calculado em um cartão/mini-diagnóstico com:

- sinais observados e fonte;
- uma frase “por que abordar agora”;
- argumento sugerido;
- CTA “preparar contato”;
- apresentação clara dentro do produto, com atribuição adequada e sem exportar Maps Content.

Não prometer auditoria de site onde só há ausência/presença, nota e avaliações. Não gerar PDF/link compartilhável com nomes, endereços, reviews ou outros dados do Places até revisão específica dos termos/licenciamento. LeadSwift e Clay mostram que sinais específicos e contexto vendem; o Radar deve começar dentro do app com os sinais que consegue provar.

**Critério de pronto:** o usuário consegue explicar em 20 segundos por que um lead está acima de outro sem consultar documentação.

#### 4. Fechar o funil de prova de valor

Garantir que o produto registre e mostre, por usuário/organização:

`buscou → abriu lead → adicionou ao pipeline → registrou consentimento/canal permitido → preparou contato → marcou resposta → marcou reunião/proposta → ganhou/perdeu`.

Não confundir “abriu WhatsApp” com mensagem entregue ou resposta. A atribuição deve ser honesta. Apollo, RD, Agendor e Clay demonstram valor por produtividade e avanço de pipeline; o Radar precisa produzir sua própria prova nos cinco pilotos.

**Critério de pronto:** o fundador consegue responder semanalmente quantas oportunidades foram encontradas, trabalhadas, responderam e avançaram.

### P1 — dias 8 a 21: aprofundar a ação, não ampliar a suíte

#### 5. Cadência com estado explícito e resultado por toque

A cadência atual deriva a etapa do tempo desde a última interação. Evoluir para registrar toque concluído, canal, resultado, próximo prazo, consentimento exigido pelo canal e motivo de encerramento. Manter WhatsApp manual somente para contatos com opt-in registrado.

**Por que:** RD, Apollo e LeadForge competem fortemente em follow-up. A versão assistida do Radar pode ser suficiente para os primeiros clientes se for confiável e não repetir/omitir passos.

#### 6. Mensagem e argumento ligados ao sinal

Preservar a IA com revisão humana e acrescentar variantes controladas por caso: sem site real, reputação fraca, poucas avaliações ou presença digital incompleta. Salvar qual argumento foi usado para depois correlacionar com resposta.

**Por que:** Clay e LeadSwift usam dados para personalização; o diferencial do Radar deve ser fazê-lo com poucos sinais explicáveis e português natural, não gerar texto genérico.

#### 7. Handoff mínimo para quem já tem CRM

Somente depois da revisão de licenciamento, oferecer handoff dos campos que o Radar pode transferir legalmente; priorizar dados inseridos pelo usuário, consentimento, atividades e identificadores permitidos. Se houver demanda real, testar webhook simples via Make/Zapier. Não prometer CSV de Maps Content nem construir sincronização bidirecional antes de saber qual CRM os compradores usam.

**Por que:** LeadSwift já integra com n8n, Zapier e HighLevel; competir como “fonte que alimenta o fluxo” amplia o mercado sem exigir substituir o CRM.

### P2 — dias 22 a 30, somente se os pilotos pedirem

#### 8. Diagnóstico leve de site

Adicionar HTTPS, responsividade/viewport, velocidade via fonte autorizada e presença de CTA/formulário somente depois de validar custo, precisão, termos e mensagem comercial. Começar com 2–4 sinais verificáveis; não criar uma pontuação opaca.

#### 9. Rota de visita

Implementar seleção de leads e abertura de rota no Google Maps/Waze apenas se ao menos dois pilotos realizarem venda externa. O Agendor comprova a categoria, mas não prova prioridade para agências digitais.

#### 10. Relatório leve com marca da agência

Se os pilotos forem agências que apresentam diagnóstico ao próprio cliente, avaliar logo e cores num relatório composto somente de análise própria e dados cuja redistribuição esteja autorizada. Evitar o white-label integral do HighLevel; nenhum relatório com Maps Content deve sair antes da revisão dos termos/licenciamento.

## 5. O que não implementar agora

1. **Inbox/API oficial do WhatsApp e disparo automático.** Exige consentimento, templates, custos por mensagem, operação e suporte; RD, LeadForge e HighLevel já são fortes aqui. Validar primeiro a cadência manual.
2. **CRM completo.** Propostas, faturamento, telefonia, chatbots, social e gestão avançada afastariam o produto da tese e do prazo.
3. **Base cadastral nacional própria.** Econodata e Apollo vencem em escala; o Radar deve vencer em contexto local e ação.
4. **Scraping/volume como argumento principal.** Outscraper torna o registro bruto barato e LeadSwift oferece grandes volumes. A cobrança deve se apoiar em oportunidade trabalhada.
5. **White-label SaaS completo.** HighLevel já oferece infraestrutura madura a US$ 497/mês; só considerar após demanda comprovada de agências.
6. **Otimização “inteligente” do score sem dados de resultado.** Primeiro coletar respostas, reuniões, ganhos e perdas; depois calibrar pesos por nicho com amostra suficiente.
7. **Muitos planos e checkout complexo.** Para cinco clientes, uma oferta, cobrança manual e contato próximo geram aprendizado mais rápido que arquitetura de billing.

## 6. Plano comercial e de produto para os 30 dias

| Período        | Produto                                                                                             | Comercial                                                        | Evidência exigida para avançar                                                    |
| -------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Dias 1–3**   | Resolver revisão/gate de Places e opt-in; congelar o fluxo seguro da demo; definir oferta fundadora | Selecionar 20 prospects do ICP e agendar 5 conversas             | Fluxo permitido documentado, 5 conversas agendadas e script de demo de até 15 min |
| **Dias 4–7**   | Destacar score/sinais e CTA permitido; validar eventos do funil                                     | Fazer demos com busca real na cidade/nicho do prospect           | 3 usuários completam busca → lead → pipeline → próxima ação permitida             |
| **Dias 8–14**  | Mini-diagnóstico in-app e cadência com estado/consentimento confiáveis                              | Pilotar com 3–5 usuários; acompanhar sessões pessoalmente        | Cada piloto trabalha ao menos 10 oportunidades e registra resultado               |
| **Dias 15–21** | Corrigir apenas bloqueios observados; export/handoff se demandado                                   | Pedir pagamento e colher objeção textual de quem recusar         | 1–3 pagamentos ou evidência clara do bloqueio dominante                           |
| **Dias 22–30** | Uma melhoria guiada pelo padrão de uso; nenhuma aposta ampla                                        | Converter os pilotos, produzir o primeiro case e pedir indicação | 5 pagantes ou decisão documentada de pivotar ICP/oferta                           |

### Métricas de verdade para a janela

- tempo até primeira busca real;
- percentual que encontra ao menos uma oportunidade considerada boa;
- oportunidades adicionadas ao pipeline por sessão;
- consentimentos registrados por origem/canal e contatos preparados;
- respostas **marcadas pelo usuário**, não inferidas;
- reuniões/propostas/ganhos;
- custo de Google/IA por organização ativa;
- conversão piloto → pagante;
- principal objeção por perda.

Não usar abertura de WhatsApp, mensagem gerada ou quantidade de leads como substituto de valor final.

## 7. Decisão recomendada

**Apostar agora:** nicho brasileiro, oportunidade explicável, canal permitido e follow-up assistido; WhatsApp somente com opt-in.  
**Provar em 30 dias:** que o usuário encontra e trabalha oportunidades melhores em menos tempo e aceita pagar o plano Profissional atual de R$ 119/mês pela continuidade.  
**Construir depois da prova:** diagnóstico de site mais rico, integração com CRM, rota e relatório de agência, conforme o perfil dos pagantes.  
**Adiar:** automação oficial de WhatsApp, white-label completo, base cadastral própria e uma suíte all-in-one.

O objetivo dos próximos 30 dias não é vencer todas as colunas da matriz. É produzir a primeira evidência local de que a sequência do Radar — descobrir, explicar, abordar e lembrar — gera uma conversa comercial que não aconteceria sem ele.
