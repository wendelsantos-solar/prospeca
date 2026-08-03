# Implementação do piloto — 1 de agosto de 2026

Branch: `codex/roadmap-v2`

Este documento registra o que foi implementado após a auditoria do roadmap, o
que precisa ser aplicado no ambiente alvo e o que continua dependendo de ação
externa. O objetivo não é transformar o produto em um CRM completo: é deixar o
núcleo descoberta → priorização → contato → próximo passo mensurável pronto
para um piloto fundador assistido.

## Entregue nesta branch

### Verdade comercial

- página de preços limitada aos planos que podem ser atendidos no piloto;
- remoção de promessas ainda inexistentes (automação, equipes, XLSX e afins);
- CTA pago convertido em solicitação de acesso, sem fingir checkout automático;
- migration que mantém catálogo futuro no banco, mas publica somente Free e
  Professional durante o piloto.

### Jornada de prospecção

- cadência persistente D+2, D+4, D+7 e D+14;
- início da cadência somente após confirmação do contato — abrir WhatsApp não
  conta como mensagem enviada;
- registro atômico de atividade e evolução da cadência no banco;
- resposta, reunião ou proposta encerra os lembretes da cadência;
- registro explícito de “resposta”, “sem resposta”, “reunião” e “proposta” no
  detalhe da oportunidade;
- materialização do lead encontrado antes de registrar o primeiro contato;
- painel com contagem de respostas, reuniões e propostas;
- explicação visual dos sinais e pontos que compõem a priorização.

### Qualidade percebida

- correção de hidratação na geolocalização;
- normalização de categorias com acentos do português;
- mesma política de senha no cadastro e na redefinição;
- configurações em modo demonstração sem falso erro de conta;
- skeletons em pipeline e preços;
- pipeline móvel com uma coluna por viewport e scroll horizontal previsível;
- mensagens de erro raiz em português;
- imagem Open Graph real em PNG 1200 × 630;
- correção do import SSR do agrupador de marcadores do mapa;
- Waze disponível por parada, respeitando o modelo de navegação para um único
  destino, enquanto o Google Maps mantém a rota completa com múltiplas paradas;
- cards do Kanban com controles semânticos separados para detalhes, arraste,
  seleção e ações, inclusive por teclado.

### Segurança, testes e operação

- headers HTTP de segurança, incluindo CSP, `nosniff`, `DENY`, política de
  referência e HSTS em HTTPS;
- lint e typecheck Deno das Edge Functions no CI;
- testes de isolamento RLS obrigatórios no CI com Supabase local;
- smoke tests Playwright de preços, demo, pipeline móvel, score e registro de
  resultado;
- artefatos locais do Playwright e bundle analyzer ignorados pelo Git;
- endpoint `/health-check/pilot-ready`, que valida banco e configuração das
  capacidades críticas sem retornar valores de segredo;
- comando único local: `bun run verify:pilot`;
- organização selecionada enviada às Edge Functions e sempre revalidada contra
  o membership autenticado, inclusive para usuários que participam de mais de
  um workspace;
- screenshots de feedback em bucket privado, com limite de tamanho/tipo, RLS
  por organização e usuário, URL assinada temporária e remoção de órfão em caso
  de falha;
- conteúdo de feedback e contato comercial escapado antes de compor e-mails;
- alerta interno de novo feedback por e-mail, quando `ADMIN_ALERT_EMAIL` está
  configurado;
- dependências transitivas vulneráveis substituídas por versões corrigidas,
  com `bun audit --production` sem vulnerabilidades.

## Evidências locais de validação

Validação executada em 1 de agosto de 2026 com Docker 28.3.3, Supabase CLI
2.111.0 e banco local novo:

- as 44 migrations foram aplicadas localmente, sem erro;
- 299 testes passaram, sem falhas ou testes ignorados;
- 35 cenários RLS passaram, incluindo uso legítimo da RPC de contato, bloqueio
  cross-tenant, encerramento da cadência por resposta e isolamento dos anexos
  privados de feedback;
- três integrações reais com o Supabase local comprovaram a seleção segura de
  workspace, a rejeição de organização sem membership e o envio de feedback
  autenticado com screenshot privado;
- lint, typecheck, Prettier, build cliente/SSR e Deno passaram;
- os quatro smoke tests Playwright passaram no Chromium;
- `bun audit --production` não encontrou vulnerabilidades conhecidas;
- `/health-check` e `/health-check/ready` responderam HTTP 200 sem token;
- `/health-check/pilot-ready` respondeu HTTP 503 localmente, como esperado,
  identificando somente os nomes das configurações de produção ausentes;
- `db lint` não apontou defeitos nas funções do produto; os avisos encontrados
  pertencem às rotinas instaladas pela extensão PostGIS.

## Aplicação no ambiente alvo

Antes de convidar o primeiro cliente pago:

1. Aplicar as migrations, inclusive:
   - `20260801000002_pilot_pricing_truth.sql`;
   - `20260801000003_contact_cadence_state.sql`;
   - `20260801000004_feedback_attachment_rls.sql`;
   - `20260801000005_feedback_attachment_owner_select.sql`.
2. Publicar as Edge Functions atualizadas.
3. Configurar no Supabase, sem colocar valores no repositório:
   - `APP_URL` e `APP_ENV=production`;
   - `GOOGLE_MAPS_SERVER_KEY`;
   - `RESEND_API_KEY` e `SALES_NOTIFY_EMAIL`;
   - `ADMIN_ALERT_EMAIL`;
   - `ANTHROPIC_API_KEY`.
4. Consultar
   `https://<project>.supabase.co/functions/v1/health-check/pilot-ready`; o
   retorno deve ser HTTP 200 e `status: "ok"`.
5. Executar um ensaio manual completo com uma conta nova: cadastro, busca,
   importação, primeiro contato, confirmação de envio, registro de resposta e
   avanço do lead.

## Ações externas ainda obrigatórias

Estas ações não podem ser concluídas somente por alteração de código:

- revisar CNPJ/razão social, Termos, Privacidade e base legal com responsável
  jurídico;
- confirmar conformidade do uso de Google Places e a política de contato pelo
  WhatsApp, inclusive opt-out e origem dos dados;
- cadastrar chaves reais, domínio, remetente de e-mail e restrições das APIs;
- executar restore de backup em ambiente separado;
- cadastrar monitor de uptime apontando para `/health-check/ready`;
- realizar cinco demonstrações reais e registrar objeções e tempo para valor;
- definir cobrança, cancelamento, SLA de suporte e responsável pelo atendimento
  manual do piloto.

## Nível de dificuldade do restante

| Entrega                                 | Dificuldade  | Motivo                                                |
| --------------------------------------- | ------------ | ----------------------------------------------------- |
| Aplicar migrations e funções em staging | Baixa        | Procedimento conhecido; exige credenciais e ambiente  |
| E2E real com Supabase e Google          | Média        | Depende de dados/quotas e limpeza determinística      |
| Restore e monitoramento                 | Média        | Mais operacional que código, mas precisa evidência    |
| Revisão legal e políticas de dados      | Alta/externa | Exige decisão empresarial e validação jurídica        |
| Checkout self-service                   | Alta         | Introduz pagamento, webhooks, inadimplência e suporte |
| WhatsApp Business API/automação         | Alta         | Política, templates, opt-in, custos e operação        |

## Ordem recomendada para os próximos dez dias

1. Dias 1–2: staging, migrations, segredos e `pilot-ready` verde.
2. Dias 3–4: ensaio ponta a ponta com dados reais e correção de regressões.
3. Dia 5: backup/restore, monitor de uptime e alertas de e-mail.
4. Dias 6–7: documentos comerciais, jurídicos e política de contato.
5. Dias 8–9: cinco demos assistidas e correção apenas de bloqueadores repetidos.
6. Dia 10: congelamento da versão, checklist de venda e roteiro de onboarding.

Depois disso, o melhor uso dos 20 dias restantes é aquisição e aprendizado com
clientes, não expansão horizontal do produto.
