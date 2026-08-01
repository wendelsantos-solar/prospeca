# Roadmap de features — diferenciação (para validação)

**Status:** rascunho pra você validar. Nada aqui foi implementado — é proposta.
**Objetivo:** depois do produto estar íntegro (roadmap de lançamento pago), o que constrói vantagem real contra quem já faz prospecção/CRM local?

---

## 1. Onde o Radar Local já compete

O produto hoje já tem uma base que a maioria dos concorrentes pesquisados **não tem junta no mesmo lugar**: descoberta via Google Places + score de oportunidade calculado (não é filtro raso — v3.0.0, pesos reais, 116 testes) + pipeline Kanban + preparo de mensagem + mapa geolocalizado + dashboard. Isso já é mais do que um gerador de lista (Econodata) e mais focado em "empresa local sem presença digital" do que um CRM genérico (RD Station, Agendor).

O buraco não é o core — é tudo que vem **depois de achar o lead**: contato repetido, prova de reputação, e uso em campo.

---

## 2. Panorama competitivo (pesquisado agora, não da memória)

| Ferramenta | O que faz bem | Onde o Radar Local pode ganhar |
|---|---|---|
| **GoHighLevel** (EUA, dominante em agências) | All-in-one: CRM + automação + IA conversacional/voz + gestão de reputação + white-label revendável pros clientes da agência. $97–497/mês. | GHL é genérico (qualquer nicho). Radar Local pode ser **fundo-a-fundo especializado em "negócio local sem presença digital"** — score e discovery que o GHL não tem nativo. |
| **RD Station CRM** (BR, líder) | Funil visual, histórico de interação (inclui WhatsApp), automação de tarefas, free tier generoso, app mobile. | RD Station não descobre lead — você importa o que já tem. Radar Local **gera o lead** a partir do mapa. Diferencial já existe, falta reforçar cadência/follow-up que o RD Station tem e o Radar Local não. |
| **Apollo.io / Clay** (EUA, prospecção B2B) | Apollo: base de 270M+ contatos + sequência de e-mail embutida. Clay: enriquecimento profundo via 150+ provedores + agente de IA ("Claygent") que extrai sinal específico do site da empresa. | Contatos globais não importam pro nicho local-BR. Mas a ideia do Claygent — **IA lendo o site/reviews do lead e extraindo sinal de venda** — é replicável em escala pequena e muito mais barata aqui. |
| **Agendor** (BR) | CRM simples + **geolocalização pra otimizar rota de visita comercial**. | Confirma que rota de visita é feature real e usada no mercado BR — e o Radar Local já tem mapa com os leads geolocalizados. Extensão natural, ninguém no nicho "sem site" faz isso ainda. |
| **Econodata** (BR) | Base de 22M empresas, enriquecimento (faturamento presumido, sócios, redes sociais), gerador de leads grátis. | Dado cadastral genérico, sem score de oportunidade nem pipeline. Radar Local já entrega isso pronto — Econodata é mais concorrente de dado bruto que de produto. |
| **LeadForge** (BR, `leadforge.com.br`) | CRM focado em WhatsApp: Kanban, resposta automática, follow-up programado, notificação de inatividade, qualificação automática, dashboard de tempo de resposta. | **Concorrente mais direto encontrado** — mesma tese de "vender pra negócio local via WhatsApp". Tem cadência automática que o Radar Local não tem. Prioridade alta fechar esse gap. |
| Padrão de mercado (pesquisa geral) | Cadência eficaz combina WhatsApp + ligação em 4 toques ao longo de 14 dias, disparada por mudança de estágio no funil ("aguardando retorno" → dispara sequência). | Radar Local hoje é *"prepara 1 mensagem"* — não *"cadência"*. É o gap mais citado em toda a pesquisa. |

---

## 3. Proposta de roadmap — 3 tiers

### 🟢 Tier 1 — Ganhos rápidos (constroem em cima do que já existe)

**3.1 Rota de visita no mapa**
Selecionar N leads do pipeline → gerar ordem de visita otimizada no mapa que já existe → abrir no Google Maps/Waze pra navegação. Zero infra nova (mapa e geolocalização já existem); só falta o algoritmo de ordenação (TSP simplificado por distância) e o botão "abrir rota".
*Por quê:* Agendor prova que o mercado BR usa e valoriza isso. Ninguém no nicho "empresa sem site" tem. Serve direto quem prospecta porta-a-porta, que é a realidade de muita agência pequena no Brasil.

**3.2 Cadência de follow-up com lembrete + rascunho pronto**
Hoje existe "preparar mensagem" pontual. Trocar por uma cadência definida (ex: D+2 WhatsApp, D+4 ligação, D+7 WhatsApp com novo argumento, D+14 encerramento) — o sistema lembra e já deixa a mensagem rascunhada pro próximo toque, mas o envio continua manual via wa.me (sem precisar de WhatsApp Business API ainda).
*Por quê:* É o gap nº1 apontado tanto pela pesquisa de mercado quanto pelo concorrente direto (LeadForge). Essa versão "manual assistida" é rápida de construir (reusa `NbaCard`/atividades que já existem) e prepara terreno pra automação de verdade depois (3.3).

**3.3 Sinal de reputação em declínio**
Já existe nota + nº de avaliações no dado do lead. Adicionar: comparar com a última vez que o lead foi visto (precisa re-poll periódico via Places API pra leads no pipeline, não pra descoberta inteira — custo controlado) e marcar "nota caindo" ou "sem resposta a review negativo recente" como sinal de oportunidade extra no score.
*Por quê:* Vira gatilho de venda concreto ("vi que sua nota caiu, posso ajudar") em vez de abordagem genérica.

### 🟡 Tier 2 — Diferenciação real (mais esforço, mais vantagem)

**3.4 Diagnóstico de site além do binário "tem/não tem"**
Pra quem tem site: checar HTTPS, responsividade mobile, velocidade (PageSpeed API), presença de Analytics/Pixel. Vira um mini-relatório de diagnóstico anexado ao lead — argumento de venda muito mais forte que "sem site" puro, e fortalece a credibilidade do score.
*Por quê:* Amplia o público endereçável (empresas com site ruim também são oportunidade, não só sem site) e dá ao vendedor um motivo específico e verificável pra abordar.

**3.5 Mensagem de primeiro contato gerada por IA a partir do sinal real**
Em vez de template com variável ({{empresa}}, {{categoria}}), um agente de IA lê os sinais já coletados (sem site / site ruim / nota caindo / categoria / cidade) e escreve uma abertura específica pra aquele lead — uma versão pequena e barata do que o Clay faz com o Claygent.
*Por quê:* É o tipo de coisa que separa "ferramenta de lista" de "ferramenta que ajuda a vender". Mensagem específica converte mais que mensagem de template, e o dado pra isso já existe no lead — só falta a chamada de IA.

**3.6 WhatsApp Business API de verdade (substituindo o link wa.me)**
Envio automático de cadência, confirmação de entrega/leitura, resposta automática de primeiro nível. Exige aprovação Meta Business + provedor (Cloud API direto ou BSP tipo Z-API/Gupshup/Twilio) e custo por conversa.
*Por quê:* É o que separa Radar Local de virar "LeadForge 2.0". Investimento maior — só depois de validar que 3.2 (cadência manual) já está sendo usada e gerando resultado.

**3.7 Times: distribuição de lead + ranking de vendedor**
Round-robin ou distribuição manual de leads entre membros da organização, painel de performance por vendedor. O modelo de organização/papéis (owner/admin/member) já existe — é extensão, não fundação nova.
*Por quê:* Relevante assim que uma agência cliente tiver mais de 1 vendedor — praticamente todo concorrente pesquisado (GHL, RD Station, Agendor) tem isso como recurso de plano pago.

### 🔵 Tier 3 — Apostas maiores (avaliar depois de validar tração)

**3.8 Extensão de navegador ("capturar este negócio")**
Adicionar manualmente um negócio do Google Maps/Instagram enquanto o vendedor navega, pros casos que a busca automática não cobre. Categoria que Apollo/Clay têm e cobre o "buraco" da busca automática.

**3.9 Exportação/relatório com marca da agência (white-label leve)**
Se o modelo de negócio de alguns clientes for "prospecção como serviço pro cliente deles", um relatório/PDF com a marca da agência (não a do Radar Local) mostrando atividade e resultados entregues. Bem mais barato que o "SaaS mode" completo do GHL — só um export com branding.

**3.10 App/PWA instalável com uso offline básico**
Dado o caso de uso de campo (visita porta-a-porta, item 3.1), ter a lista do dia disponível offline e instalável no celular tem valor real pra quem não tem 4G confiável na rua.

**3.11 Integrações (Zapier/Make, exportar pra RD Station/Pipedrive)**
Joga o Radar Local no ecossistema de quem já usa outro CRM — modelo "alimentamos seu funil" em vez de competir de frente. Baixa prioridade pros primeiros 5 clientes, relevante pra escalar depois.

---

## 4. Recomendação de sequência

Não é código ainda — isso é a minha sugestão de ordem, você decide:

1. Fechar o roadmap de lançamento pago primeiro (P1 residual + deploy) — vender pros 5 antes de adicionar feature nova.
2. **3.1 (rota) + 3.2 (cadência manual)** — mais barato, mais alinhado com o que o mercado local BR já paga por (Agendor, LeadForge), reusa infraestrutura que já existe.
3. **3.5 (mensagem por IA)** — diferencial visível rápido, custo de implementação baixo (é só uma chamada de LLM em cima de dado que já existe).
4. **3.4 (diagnóstico de site) + 3.3 (reputação em declínio)** — fortalece o score, amplia o mercado endereçável.
5. **3.6 (WhatsApp API) + 3.7 (times)** — só depois de ter validação de que as anteriores estão sendo usadas de verdade por clientes pagantes.
6. Tier 3 — avaliar caso a caso conforme o perfil dos primeiros clientes (se aparecer agência com múltiplos vendedores, prioriza 3.7 antes da ordem acima).

---

## Fontes (pesquisa desta sessão)

- [GoHighLevel Features 2026](https://autogencrm.com/gohighlevel-features/), [GHL White Label Guide](https://ghlcrm.me/go-high-level-crm-white-label/)
- [RD Station CRM — funcionalidades e planos](https://melhorescrm.com/analise/rd-station-crm/), [RD Station CRM preços](https://www.rdstation.com/planos/crm/)
- [Apollo.io vs Clay 2026](https://moderninbound.com/blog/clay-vs-apollo), [Clay vs Apollo — Salesmotion](https://salesmotion.io/clay-vs-apollo)
- [Agendor — CRM brasileiro](https://www.agendor.com.br/blog/crm-brasileiro/)
- [Econodata — Gerador de Leads Grátis](https://www.econodata.com.br/gerador-de-leads-gratis), [Enriquecimento de dados](https://www.econodata.com.br/enriquecimento-de-dados)
- [LeadForge — CRM para WhatsApp](https://www.leadforge.com.br/)
- [Cadência de follow-up WhatsApp B2B](https://winningsales.com.br/blog/follow-up/), [Follow-up automático WhatsApp](https://www.clint.digital/blog/industria-whatsapp-oficial-automacoes-sem-aumentar-time)
