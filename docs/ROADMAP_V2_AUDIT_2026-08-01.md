# Roadmap V2 — auditoria do produto e plano de venda em 30 dias

**Data da auditoria:** 01/08/2026  
**Branch:** `codex/roadmap-v2`  
**Escopo:** código, roadmaps, documentação, testes, build, segurança, operação, experiência desktop/mobile, identidade visual, oferta comercial e mercado.  
**Regra desta rodada:** nenhuma funcionalidade do produto foi implementada. Esta entrega contém somente diagnóstico e documentação.

## 1. Veredito executivo

**O roadmap não está totalmente implementado e o produto ainda não deve ser apresentado como um SaaS self-service completo.**

O Prospeca possui uma base de produto acima do estágio de protótipo: busca geográfica, score, mapa, pipeline, tela Hoje, rota, primeiro contato assistido por IA, quotas, autenticação, organizações e boa cobertura de testes unitários. A arquitetura é coerente e a interface desktop transmite qualidade.

O maior risco não é falta de telas. É a diferença entre três realidades:

1. a documentação registra vários itens como concluídos;
2. o código contém parte relevante deles;
3. a operação ponta a ponta, a produção e as promessas comerciais não estão todas verificadas.

Hoje o produto está:

- **apto para demonstrações controladas**, com ressalvas no modo demo;
- **próximo de um piloto fundador pago**, após fechar os bloqueadores P0 deste relatório;
- **não comprovado para lançamento self-service público**, cobrança recorrente e promessas amplas da página de preços.

### Leitura geral

| Área                          | Estado                                | Leitura                                                                                              |
| ----------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Proposta central              | Boa                                   | Descoberta local, priorização e ação assistida formam uma jornada coerente                           |
| Arquitetura e código          | Boa                                   | Módulos, contratos e isolamento por organização são bem desenhados                                   |
| Testes unitários              | Boa                                   | 246 testes passaram; lint web, typecheck e build passaram                                            |
| Validação de segurança        | Incompleta                            | 31 testes RLS foram ignorados porque o Supabase local não subiu                                      |
| CI/CD e produção              | Incompleta                            | Deno lint falha, E2E não está no CI e deploy/segredos/restore não foram comprovados                  |
| UX desktop                    | Boa, com defeitos                     | Interface coerente, mas existe erro real de hidratação e estados de carga frágeis                    |
| UX mobile                     | Parcial                               | Navegação funciona; Kanban demora sem feedback e usa largura horizontal pouco adequada               |
| Design system                 | Visualmente bom, tecnicamente parcial | Cores são consistentes; tipografia e registro central de ícones não foram adotados de forma uniforme |
| Oferta e preços               | Risco alto                            | A página vende capacidades que não estão entregues ou conectadas ao entitlement real                 |
| Prontidão de venda em 30 dias | Viável como piloto                    | Exige oferta estreita, conformidade, operação verificada e acompanhamento manual do fundador         |

## 2. O que foi auditado

Foram confrontados os documentos abaixo com código, testes, migrations e comportamento visível:

- [PAID_LAUNCH_ROADMAP_2026-08.md](./PAID_LAUNCH_ROADMAP_2026-08.md)
- [FEATURE_ROADMAP_2026-08.md](./FEATURE_ROADMAP_2026-08.md)
- [PAID_LAUNCH_READINESS_CHECKLIST.md](./PAID_LAUNCH_READINESS_CHECKLIST.md)
- [SAAS_PRODUCTION_ROADMAP.md](./SAAS_PRODUCTION_ROADMAP.md)
- documentos de design system, segurança, billing, ambientes e operação;
- aplicação React/TanStack, pacotes compartilhados e 23 Edge Functions Supabase;
- aplicação local em desktop e viewport móvel;
- pesquisa competitiva de primeira parte em [COMPETITIVE_RESEARCH_2026-08.md](./COMPETITIVE_RESEARCH_2026-08.md).

### Limites da conclusão

- A auditoria não acessou o projeto Supabase de produção, host do frontend, conta de e-mail, Sentry, monitor de uptime ou provedor financeiro.
- Segredos de produção, migrations remotas, funções implantadas, redirects de autenticação, DNS e restore de backup continuam **não verificados**.
- A branch foi criada a partir de uma `main` que já estava 16 commits à frente de `origin/main` e continha alterações locais anteriores em `docs/DEPLOYMENT.md`, `docs/FEATURE_ROADMAP_2026-08.md`, `.env.local.bak` e `apps/web/stats.html`. Esses arquivos foram preservados.

## 3. Validação técnica executada

| Verificação                                | Resultado           | Observação                                                                                           |
| ------------------------------------------ | ------------------- | ---------------------------------------------------------------------------------------------------- |
| `bun run test`                             | Passou              | Suíte configurada do workspace passou                                                                |
| `bun test`                                 | Passou parcialmente | 246 passaram, 31 foram ignorados; os ignorados são justamente os testes cross-tenant/RLS             |
| `bun run lint`                             | Passou              | Lint do workspace web passou                                                                         |
| `bun run typecheck`                        | Passou              | Tipos consistentes                                                                                   |
| `bun run build`                            | Passou              | Build de produção gerado com avisos de chunks/import dinâmico                                        |
| `bun run format:check`                     | Falhou por artefato | `apps/web/stats.html`, gerado pelo build e não ignorado, entra na checagem                           |
| `deno check supabase/functions/*/index.ts` | Passou              | Edge Functions passaram na verificação de tipos                                                      |
| `deno lint supabase/functions/`            | Falhou              | Ignores não usados, `any` e import não usado; a mesma etapa está no CI                               |
| `bunx knip`                                | Falhou/alertou      | Dependências/imports não declarados e muitos exports não utilizados; há falsos positivos de CSS/Deno |
| Supabase local                             | Não executou        | CLI instalada (`2.84.2`) não entende chaves do `config.toml`; sugere versão mais nova                |
| E2E Playwright                             | Não executado       | Dependência não está declarada e a suíte não é executada pelo CI atual                               |

### Problemas técnicos prioritários

1. **O CI documentado como verde não é reproduzível:** `deno lint` falha no estado atual.
2. **A garantia RLS não foi exercitada:** todos os 31 testes de isolamento foram ignorados neste ambiente e também tendem a ser ignorados no CI, que não inicia o Supabase.
3. **Build suja a árvore:** o visualizer cria `apps/web/stats.html`, que não está no `.gitignore` e faz a verificação de formato falhar depois do build.
4. **E2E não funciona como gate:** existe configuração, mas falta dependência declarada e workflow.
5. **Produção não está descrita de forma operacional:** runbook e ambientes ainda contêm destinos “a definir”; não há evidência de CD completo.

## 4. Status do roadmap de lançamento pago

### P0 do documento original

Os itens de código 1–9 — RLS, autenticação, quotas, billing base, suppression list, analytics, tratamento de erros e segurança de busca — possuem implementação ou correção correspondente no repositório. Isso não torna o lançamento pago concluído, porque a prova operacional ficou fora do código.

**Classificação:** implementado em código, produção não certificada.

Antes de considerar os P0 encerrados, ainda é necessário:

- executar as migrations em staging/produção e provar o isolamento RLS;
- verificar todas as Edge Functions implantadas e seus segredos;
- confirmar domínio, redirects, CORS, e-mail transacional e alertas;
- fazer smoke test real de signup, busca, quota, importação, exclusão, erro e opt-out;
- validar contratos/licenciamento do Google Maps/Places e tratamento de contato/consentimento;
- alinhar termos, privacidade, cobrança, cancelamento e identidade jurídica.

### P1/P2 do documento original

| Item                             | Estado verificado      | Evidência/pendência                                                    |
| -------------------------------- | ---------------------- | ---------------------------------------------------------------------- |
| Sitemap                          | Implementado em código | Domínio final precisa ser confirmado                                   |
| OG image PNG                     | **Não concluído**      | A raiz ainda referencia `/og-image.svg`                                |
| Link morto do fundador           | Concluído              | Correção encontrada                                                    |
| Link da agência no footer        | Concluído              | Correção encontrada                                                    |
| Digest de erros                  | Parcial                | Código existe; deploy e `ADMIN_ALERT_EMAIL` não foram comprovados      |
| Uptime monitor                   | **Não comprovado**     | Ação externa pendente                                                  |
| Plano Supabase e restore         | **Não concluído**      | Não há evidência de teste de restauração                               |
| Vault/secrets de produção        | **Não comprovado**     | Ação externa pendente                                                  |
| Estado de erro do histórico      | Concluído              | Correção encontrada                                                    |
| Exclusão de conta                | Parcial                | Código existe; deploy e smoke test não foram comprovados               |
| Notificação de contato comercial | Parcial                | Código existe; deploy e `SALES_NOTIFY_EMAIL` não foram comprovados     |
| Força de senha                   | **Inconsistente**      | UI exibe quatro requisitos, mas schema exige apenas comprimento mínimo |
| Dados legais                     | **Não concluído**      | Privacidade ainda contém TODO para razão social/CNPJ/endereço          |

## 5. Status do roadmap de funcionalidades 3.x

O cabeçalho do roadmap diz que nada foi implementado, mas isso ficou desatualizado. A realidade é:

| Feature                            | Status real                                         | Conclusão                                                                                                                                       |
| ---------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1 Planejamento de rota           | **Implementação central concluída**                 | Seleção, algoritmo guloso e abertura no Google Maps existem; a opção Waze prometida não existe                                                  |
| 3.2 Cadência de follow-up          | **Parcial e frágil no fluxo real**                  | Regras D+2/D+4/D+7/D+14 e tela Hoje existem, mas o toque de WhatsApp não persiste interação/etapa; leads novos podem nascer sem âncora temporal |
| 3.3 Queda de reputação             | **Não implementada**                                | Falta snapshot histórico e nova coleta de nota/reviews                                                                                          |
| 3.4 Diagnóstico de site            | **Não implementado**                                | Não há PageSpeed, responsividade, pixel ou análise técnica equivalente                                                                          |
| 3.5 Primeiro contato com IA        | **Implementado em código; operação não comprovada** | Edge Function, heurística, UI e testes existem; chave Anthropic/deploy de produção não foram verificados                                        |
| 3.6 WhatsApp Business API          | **Não implementada**                                | O produto abre `wa.me`; não há inbox, templates ou envio oficial pela API                                                                       |
| 3.7 Distribuição/ranking de equipe | **Não implementada**                                | Há coluna antiga `assigned_to`, mas não há fluxo funcional de equipe/ranking                                                                    |
| 3.8 Extensão de navegador          | **Não implementada**                                | Nenhuma extensão encontrada                                                                                                                     |
| 3.9 Relatório white-label          | **Não implementado**                                | Nenhum fluxo de relatório/PDF com marca                                                                                                         |
| 3.10 PWA/offline                   | **Fundação parcial**                                | Manifesto existe; service worker e estratégia offline não existem                                                                               |
| 3.11 Integrações                   | **Não implementadas**                               | Sem integrações funcionais equivalentes às prometidas                                                                                           |

### Falha funcional mais importante do roadmap 3.x

A cadência parece completa quando observada isoladamente, mas não fecha o ciclo real. Ela calcula lembretes a partir de `lastInteractionAt`; abrir o WhatsApp não atualiza esse campo nem salva um toque. Na importação, um novo lead pode entrar como `contacted` sem `last_interaction_at`. O resultado possível é um usuário fazer o primeiro contato e nunca receber o follow-up esperado.

## 6. Auditoria visual e de experiência

### O que está bom

- Identidade visual coerente, com fundo quente, verde como ação primária e superfícies claras.
- Tokens semânticos em OKLCH para tema claro/escuro; poucas cores diretas fora do mapa.
- Fonte Inter hospedada no projeto, com bom acabamento geral.
- Navegação desktop, mapa, tela Hoje, cards e diálogos têm aparência de produto real.
- Lucide fornece uma família de ícones consistente.
- A maior parte dos controles possui rótulo ou `aria-label`; a base de acessibilidade é razoável.
- Login e preços funcionam visualmente bem em desktop e mobile depois do carregamento.

### O que precisa ser corrigido

#### P0 de UX

1. **Erro de hidratação em rotas do app.** `useGeolocation.ts` calcula suporte a geolocalização no escopo do módulo. No servidor retorna falso; no cliente, verdadeiro. O botão de GPS muda a árvore entre SSR e hidratação, e o React refaz a tela no cliente.
2. **Kanban mobile sem feedback inicial.** `KanbanBoard` e `KanbanTopBar` são lazy-loaded com fallback `null`; a região fica vazia por cerca de 2,5 s. Depois, várias colunas horizontais e controles recortados dificultam a operação.
3. **Modo demo quebra em Configurações.** A tela mostra um grande erro “Não foi possível carregar sua conta”, prejudicando uma demonstração comercial.
4. **Página de preços carrega sem skeleton.** Os cards surgem depois de uma área vazia, o que pode parecer falha em conexão mais lenta.
5. **Capitalização incorreta em categorias acentuadas.** O regex de `category.ts` não é Unicode-aware e produz textos como “ClíNica MéDica” e “SalãO De Beleza”.

#### P1 de UX e acessibilidade

- O mapa usa `google.maps.Marker`, atualmente marcado como deprecated no console.
- O card arrastável funciona como botão e contém outros botões/checkboxes, uma combinação problemática para teclado e semântica.
- Página de erro e not-found possuem trechos em inglês, destoando do pt-BR.
- Chunks grandes e lazy loading sem estados de transição afetam a percepção de velocidade.

## 7. Tipografia, cores e ícones

### Tipografia

O projeto documenta uma escala nominal (`display`, `page-title`, `section`, `card`, `body`, `caption`, `micro`), mas o código usa muitas medidas paralelas:

- 133 ocorrências de `text-sm`;
- 130 de `text-xs`;
- 55 de `text-[11px]`;
- 35 de `text-[10px]`;
- 32 de `text-[11.5px]`;
- além de vários tamanhos 12, 12.5 e 13 px.

**Conclusão:** a tipografia parece consistente ao olhar, mas não está padronizada no código. Isso aumenta o custo de manutenção e cria pequenas diferenças entre telas.

**Recomendação:** não fazer um rewrite antes da venda. Corrigir primeiro as telas tocadas pelos P0 e exigir tokens nomeados em novos componentes. Migrar por área, com teste visual.

### Cores

As cores são uma das partes mais fortes do sistema. Os tokens semânticos são usados de maneira ampla e só foram encontradas poucas cores utilitárias diretas fora de casos intencionais. Os hexadecimais de mapas e logos são esperados, embora valores do mapa possam ser centralizados.

**Conclusão:** preservar a paleta. A prioridade não é rebranding; é garantir contraste, estados de loading/erro e uso consistente dos tokens existentes.

### Ícones

O uso exclusivo de Lucide dá unidade visual, mas a documentação diz que o Icon System V2 foi concluído enquanto a adoção do registro `AppIcon` é pequena: dezenas de arquivos importam Lucide diretamente e poucos passam pelo registro central.

**Conclusão:** o resultado visual é bom; a governança está incompleta e a documentação está otimista. Decidir entre um registro central realmente obrigatório ou imports diretos padronizados. Não sustentar os dois modelos como se a migração estivesse concluída.

## 8. Risco comercial: o site promete mais do que o produto entrega

Este é o bloqueador mais grave para receber dinheiro com segurança.

A documentação de planos, seeds de billing e componentes públicos anunciam ou sugerem capacidades como:

- XLSX;
- cadências e automações completas;
- analytics avançado;
- gestão e distribuição de equipe;
- permissões customizadas;
- múltiplos usuários no plano Agency;
- consumo/limites visíveis e cancelamento de assinatura.

Na implementação atual:

- exportação real é CSV, não XLSX;
- cadência é parcial e não possui estado confiável por toque;
- gestão/distribuição de equipe não existe como fluxo funcional;
- entitlements documentados não estão conectados de ponta a ponta aos fluxos reais;
- não foi encontrada experiência completa de pagamento, cancelamento, reembolso e lifecycle de assinatura.

**Decisão recomendada:** antes de captar pagamento público, substituir a amplitude por uma oferta fundadora explícita, com escopo e operação manual transparentes. Não exibir como disponível algo que depende de roadmap.

## 9. Segurança, privacidade e operação

### Pontos positivos

- Modelo multi-tenant por organização e políticas RLS extensas.
- Contratos compartilhados e validação de entrada.
- Suppression list/opt-out.
- Proteções de SSRF e tratamento de erros nas Edge Functions.
- Telemetria de erros e digest foram desenhados.

### Pendências antes de venda

1. Tornar o teste RLS executável no CI e obter uma execução verde real.
2. Corrigir o lint Deno e adicionar smoke/E2E como gate.
3. Confirmar secrets, logs, alertas, budgets e rate limits em produção.
4. Configurar uptime externo e realizar restore documentado.
5. Preencher dados da controladora e submeter termos/privacidade a revisão jurídica.
6. Alinhar a política de cobrança, cancelamento e reembolso ao processo que realmente será oferecido.
7. Revisar o uso, retenção, derivação e possível exportação de Google Places Content segundo os termos aplicáveis.
8. Revisar a base legal, origem, consentimento e canal para contatos; telefone público não deve ser tratado automaticamente como autorização para WhatsApp Business Platform.
9. Adicionar cabeçalhos de segurança do frontend, incluindo uma CSP adequada, após testar integrações necessárias.

Esses itens exigem validação jurídica e operacional específica; este relatório não constitui parecer jurídico.

## 10. Comparação com produtos que já monetizam

A pesquisa completa, com fontes oficiais, preços e cases, está em [COMPETITIVE_RESEARCH_2026-08.md](./COMPETITIVE_RESEARCH_2026-08.md).

### Concorrência direta

- **Prospek:** Maps + Receita + contatos + WhatsApp + Kanban, a partir de R$ 39,90/mês.
- **Prospex:** Maps + score digital + mensagem, R$ 97/mês.
- **LeadScout:** Maps + Kanban + IA em pay-as-you-go.
- **LeadSwift:** empresas locais + sinais de site + outreach, a partir de US$ 24,99/mês.
- **Outscraper:** torna o dado bruto muito barato; prova que CSV/volume não é diferenciação sustentável.

### Referências de categoria

- **RD Station/Agendor:** Kanban, tarefas e follow-up já são baratos ou gratuitos; o Radar precisa ganhar no momento anterior: quem abordar, por quê e com qual argumento.
- **Econodata/Apollo:** profundidade e volume de dados são jogos de escala; não são a melhor batalha para os próximos 30 dias.
- **Clay:** mostra o valor de sinais explicáveis e personalização baseada em evidência.
- **HighLevel:** mostra como agências pagam por uma solução empacotada, mas sua amplitude não deve ser copiada agora.
- **Localo:** é uma boa referência de diagnóstico local transformado em próxima ação simples.
- **Waalaxy:** prova o valor de uma promessa estreita e um fluxo de ativação fácil.

### Posicionamento recomendado

> **Prospeca encontra oportunidades comerciais em negócios da sua região, explica por que abordá-las e ajuda você a iniciar e acompanhar a conversa.**

**ICP inicial:** agências pequenas, freelancers e prestadores que vendem sites, SEO local, reputação, marketing ou automação para negócios locais e ainda prospectam manualmente.

**Não vender como:** CRM completo, scraper de Google Maps, automação de WhatsApp ou plataforma all-in-one.

## 11. Roadmap V2 recomendado para os próximos 30 dias

### Semana 1 — verdade comercial e base operacional

**Objetivo:** tornar a demonstração e a oferta seguras.

- corrigir a página de preços e os planos para refletirem somente o que existe;
- definir oferta fundadora, escopo, cobrança manual e política de cancelamento;
- decidir ICP único e script de demo de até 15 minutos;
- resolver hidratação, capitalização, erro de Configurações no demo e loaders críticos;
- corrigir Deno lint e o artefato `stats.html`;
- atualizar Supabase CLI, rodar RLS local e tornar o gate obrigatório no CI;
- verificar staging/produção, secrets, e-mails, migrations, redirects e smoke tests;
- obter revisão dos fluxos de Places, LGPD, consentimento/canais e textos legais;
- configurar uptime e testar restore.

**Saída:** produto demonstrável sem promessa falsa e checklist de produção com evidência.

### Semana 2 — fechar a jornada que será vendida

**Objetivo:** garantir `descoberta → priorização → ação permitida → follow-up`.

- corrigir persistência do primeiro contato e estado explícito da cadência;
- mostrar claramente os sinais e o motivo do score;
- registrar ação, resposta, reunião/proposta e ganho/perda sem inferir resultados;
- validar mensagem por IA em produção e manter revisão humana;
- melhorar o Kanban mobile e estados de carregamento;
- instrumentar as métricas essenciais do piloto.

**Saída:** fluxo central confiável, mensurável e explicável.

### Semana 3 — pilotos assistidos

**Objetivo:** colocar 3–5 usuários do ICP trabalhando oportunidades reais.

- selecionar 20 prospects e realizar pelo menos 5 demos;
- conduzir onboarding pessoalmente;
- acompanhar sessões e corrigir somente bloqueios observados;
- exigir que cada piloto trabalhe pelo menos 10 oportunidades;
- registrar objeções, tempo para valor, respostas, reuniões e custo de dados/IA.

**Saída:** evidência de uso real e primeira solicitação de pagamento.

### Semana 4 — conversão e case

**Objetivo:** chegar aos primeiros clientes pagantes e aprender com perdas.

- converter pilotos para a oferta fundadora;
- produzir um case curto com números honestos;
- pedir indicação aos usuários que obtiverem valor;
- implementar apenas uma melhoria repetidamente pedida pelos pilotos;
- documentar o motivo dominante de cada não conversão.

**Saída:** meta de até 5 clientes pagantes ou evidência suficiente para ajustar ICP/oferta.

### O que adiar nesses 30 dias

- WhatsApp Business API e disparos automáticos;
- white-label completo;
- extensão de navegador;
- CRM amplo, propostas/faturamento/telefonia;
- base cadastral própria;
- integrações bidirecionais complexas;
- score “inteligente” antes de coletar resultado real;
- rebranding ou reescrita completa do design system.

## 12. Critérios objetivos para autorizar a venda

O piloto pago pode começar quando todos os itens abaixo estiverem verdadeiros:

- [ ] página de preços/oferta não anuncia feature inexistente;
- [ ] escopo, cobrança, cancelamento e suporte do piloto estão escritos;
- [ ] dados legais mínimos e documentos revisados estão publicados;
- [ ] fluxo permitido de dados/contato foi revisado e documentado;
- [ ] migrations e Edge Functions do ambiente alvo foram comprovadas;
- [ ] RLS cross-tenant executou sem testes ignorados;
- [ ] `format`, lint web, lint Deno, types, testes e build estão verdes;
- [ ] smoke/E2E cobre signup, busca, importação, contato, opt-out e exclusão;
- [ ] uptime e restore foram testados;
- [ ] hidratação, cadência e demo Settings foram corrigidos;
- [ ] eventos medem oportunidade trabalhada, resposta e avanço real;
- [ ] cinco demos reais foram realizadas e as objeções foram registradas.

O lançamento self-service exige, além disso, lifecycle financeiro, suporte, alertas e processos operacionais comprovados.

## 13. Decisão final

**Não implementar todas as features faltantes do roadmap.** Isso reduziria a chance de venda no prazo.

O caminho mais forte é corrigir a verdade comercial e os defeitos ponta a ponta, vender um piloto assistido do núcleo que já existe e usar os primeiros clientes para decidir a próxima feature. A vantagem atual não é ser a plataforma com mais módulos. É conduzir rapidamente uma pessoa de um mapa cheio de empresas para uma oportunidade explicada, uma abordagem específica e um próximo passo que não se perde.
