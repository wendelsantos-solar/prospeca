# Pendências reais — Roadmap V2

**Data:** 1 de agosto de 2026  
**Branch:** `codex/roadmap-v2`  
**Objetivo:** separar o que ainda é bloqueador de venda, o que melhora o
produto e o que deve ficar fora da janela de dez dias.

## Veredito atualizado

O núcleo do piloto está funcional e passou pelo gate local completo. A branch
está tecnicamente pronta para ser levada a staging, mas produção ainda não está
certificada. O risco principal deixou de ser uma falha central de produto e
passou a ser implantação, configuração, ensaio com serviços reais, operação e
conformidade.

Não recomendo preencher os próximos dez dias com novas features grandes. O
melhor retorno para a venda em 30 dias é provar a jornada real, corrigir apenas
fricções repetidas nas demonstrações e fechar os controles operacionais.

## Fechado nesta rodada adicional

| Item                    | Resultado                                                                                            | Evidência                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Feedback com screenshot | Bucket privado, MIME/tamanho limitados, RLS por organização/usuário, URL assinada e limpeza de órfão | Testes RLS e integração real com Supabase local                   |
| Feedback interno        | Persistência com `screenshot_path`, conteúdo escapado e alerta por e-mail                            | Testes de escape e check Deno                                     |
| Multi-workspace         | Edge Functions recebem a organização ativa e validam membership antes de usá-la                      | Testes com um usuário em duas organizações e tentativa sem acesso |
| Waze                    | Navegação por parada; Google Maps continua com a rota multiponto                                     | Teste unitário e inspeção visual                                  |
| Kanban acessível        | Detalhes, alça de arraste, checkbox e ações deixaram de ser controles interativos aninhados          | Typecheck e inspeção semântica no navegador                       |
| Dependências            | Overrides documentados para versões corrigidas, sem majors diretos desnecessários                    | `bun audit --production`: zero vulnerabilidades                   |
| Regressões              | Gate único executado após todas as mudanças                                                          | 299 testes, 35 RLS, build, Deno e 4 E2E verdes                    |

## Pendências internas de produto

Estas tarefas podem ser feitas em código, mas não impedem um piloto fundador
assistido.

| Prioridade | Pendência                                                                                                | Dificuldade                       | Estimativa | Decisão recomendada                                                                |
| ---------- | -------------------------------------------------------------------------------------------------------- | --------------------------------- | ---------- | ---------------------------------------------------------------------------------- |
| P1         | Migrar `google.maps.Marker` para `AdvancedMarkerElement`, incluindo Map ID e compatibilidade com cluster | Média                             | 1–2 dias   | Fazer depois de validar a chave/mapa de staging; não misturar com o deploy inicial |
| P1         | E2E em modo real para cadastro, busca Google, importação, opt-out e exclusão de conta                    | Média                             | 2–3 dias   | Executar em staging com chaves e quotas próprias                                   |
| P2         | Reduzir o chunk principal e o import dinâmico ineficaz de `services/index.ts`                            | Média                             | 1–2 dias   | Medir em staging antes; otimizar somente se afetar tempo para valor                |
| P2         | Consolidar a escala tipográfica e a política de ícones                                                   | Baixa por tela, média no conjunto | 2–4 dias   | Migrar incrementalmente; a interface já é visualmente coerente                     |
| P3         | Criar caixa administrativa de feedback                                                                   | Baixa                             | 1 dia      | Só fazer se o e-mail não atender ao volume do piloto                               |

### Por que tipografia, cores e ícones não são P0

- A paleta semântica e o contraste geral são coerentes; não há justificativa
  comercial para rebranding agora.
- A tipografia aparenta consistência, embora o código ainda misture tokens com
  tamanhos arbitrários. Uma troca em massa aumenta o risco visual antes das
  demos.
- Lucide mantém unidade visual. O problema restante é de governança entre
  imports diretos e o registro central, não de percepção imediata do cliente.

## Bloqueadores externos antes de cobrar

Nenhum destes itens pode ser comprovado apenas pelo repositório local.

1. Criar ou confirmar staging e produção e vincular o projeto correto do
   Supabase.
2. Aplicar as migrations `20260801000002` até `20260801000005` e publicar as
   Edge Functions atualizadas.
3. Configurar `APP_URL`, `APP_ENV`, chaves Google, Resend,
   `SALES_NOTIFY_EMAIL`, `ADMIN_ALERT_EMAIL` e Anthropic.
4. Exigir HTTP 200 e `status: "ok"` em
   `/health-check/pilot-ready`, sem desabilitar capacidades para esconder
   configuração ausente.
5. Rodar uma conta nova em modo real: cadastro → busca → importação → contato
   confirmado → resposta → avanço no pipeline → opt-out → exclusão.
6. Preencher razão social/CNPJ/endereço ainda pendentes na política de
   privacidade e obter revisão jurídica de Termos, Privacidade, base legal e
   abordagem por WhatsApp.
7. Configurar monitor externo de uptime e executar um restore de backup em
   ambiente separado.
8. Definir cobrança manual do piloto, cancelamento, reembolso, SLA de suporte e
   responsável por onboarding.

## Plano sugerido para os dez dias restantes de produto

| Dia | Entrega verificável                                                    |
| --- | ---------------------------------------------------------------------- |
| 1   | Staging ligado, migrations e funções publicadas                        |
| 2   | Segredos configurados e `pilot-ready` verde                            |
| 3   | E2E real de cadastro, busca e importação                               |
| 4   | E2E real de contato, cadência, opt-out e exclusão                      |
| 5   | Monitor de uptime, alerta de feedback/erro e restore comprovado        |
| 6   | Dados legais, oferta fundadora, cancelamento e suporte definidos       |
| 7   | Primeira demonstração assistida; registrar tempo para valor e objeções |
| 8   | Corrigir somente bloqueadores observados em mais de uma sessão         |
| 9   | Mais quatro demonstrações e ensaio de onboarding/cobrança              |
| 10  | Congelar versão, checklist de release e início da aquisição            |

## Fora da janela de dez dias

Histórico de reputação, diagnóstico automático de sites, WhatsApp Business API,
distribuição/ranking de equipe, extensão, white-label, PWA/offline, integrações
amplas e checkout self-service continuam válidos como expansão futura. Eles não
devem ser prometidos como disponíveis nem competir com a prova do piloto nos
próximos 30 dias.

## Critério de pronto para a primeira venda

O piloto está pronto para cobrança quando: o gate local continua verde;
staging executa a jornada real sem intervenção técnica; `pilot-ready` está
verde; restore e monitor têm evidência; documentos e processo comercial
descrevem exatamente a oferta disponível; e pelo menos cinco prospects passam
pela demonstração sem encontrar um bloqueador repetido.
