# Estratégia de integrações Google — agosto de 2026

## Acompanhamento da implementação

Atualizado em **8 de agosto de 2026**. Neste checklist, `[x]` significa implementado e, quando indicado, validado no ambiente remoto. A aprovação pública do Google continua sendo uma etapa separada.

### Entregue no código

- [x] Transformar `Configurações → Integrações` em uma central voltada ao usuário, com benefício, estado da conexão e ações.
- [x] Tratar Google Calendar e geração do Google Meet como uma única integração.
- [x] Criar modelo multi-tenant para conexão por usuário e organização.
- [x] Separar metadados visíveis das credenciais OAuth protegidas.
- [x] Cifrar access token e refresh token com AES-256-GCM no backend.
- [x] Implementar OAuth com estado imprevisível, hash, expiração, uso único e bloqueio de redirecionamento externo.
- [x] Implementar os estados conectado, reconexão necessária e erro.
- [x] Implementar conexão, consulta de status, renovação de token, revogação e desconexão.
- [x] Corrigir atividades para persistirem horário, duração, fuso e e-mail do convidado.
- [x] Permitir criar evento no Calendar e link exclusivo do Meet a partir de uma atividade do tipo reunião.
- [x] Tornar a criação idempotente e persistir o vínculo entre atividade e evento externo.
- [x] Manter a atividade local quando o Google falhar e comunicar o erro sem bloquear o fluxo comercial.
- [x] Exibir links para abrir o Meet e o evento do Calendar na atividade.
- [x] Exibir horário e ações de Meet/Calendar também nas páginas Hoje e Agenda.
- [x] Adicionar testes para redirecionamento seguro, idempotência, payload do evento e cifra das credenciais.
- [x] Documentar as novas variáveis de ambiente em `.env.example`.

### Configuração remota e validação

- [x] Criar um projeto Google Cloud exclusivo `Prospeca` para o ambiente de teste, sem reutilizar as credenciais de outros produtos.
- [ ] Criar um segundo projeto Google Cloud exclusivo para produção, antes do rollout público.
- [x] Habilitar a Google Calendar API e criar o cliente OAuth web `Prospeca Calendar`.
- [x] Configurar `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET` e `GOOGLE_CALENDAR_REDIRECT_URI` nos secrets do Supabase.
- [x] Gerar e cadastrar `INTEGRATION_TOKEN_ENCRYPTION_KEY` nos secrets do Supabase.
- [x] Aplicar a migration `20260808000001_google_calendar_integrations.sql` no Supabase remoto.
- [x] Publicar a Edge Function `google-calendar` no Supabase remoto.
- [x] Publicar e validar a central de integrações e o agendamento no frontend de produção.
- [x] Fazer o teste ponta a ponta com `wendelpaco@gmail.com`: conectar, criar reunião sem convidado, gerar o evento e confirmar os links do Calendar e do Meet nas páginas Hoje e Agenda.
- [ ] Validar o envio de convite para um convidado externo e o ciclo completo de desconectar/reconectar.
- [ ] Preparar marca, política de privacidade, termos, domínio verificado e justificativa de escopo para a verificação OAuth.
- [ ] Adicionar atualização e cancelamento do evento quando a atividade mudar na Prospeca.
- [ ] Instrumentar métricas de conexão iniciada/concluída, reunião criada, falha e desconexão.
- [ ] Fazer rollout gradual para usuários piloto antes de disponibilizar a toda a base.

#### Estado validado em 8 de agosto de 2026

- Projeto Google Cloud: `Prospeca` (`prospeca`), isolado e com o OAuth no status **Testando**.
- Usuário de teste autorizado: `wendelpaco@gmail.com`.
- Escopos configurados: identidade básica e `calendar.events.owned`; nenhum acesso amplo à agenda foi solicitado.
- Callback remoto: Edge Function `google-calendar` no projeto Supabase do Prospeca.
- Teste real: atividade `[Teste Prospeca] Google Calendar + Meet`, em 08/08/2026 às 14:30, criada na oportunidade e confirmada no Google Calendar com link exclusivo do Meet.
- Enquanto o aplicativo estiver em **Testando**, somente usuários cadastrados como teste poderão conectar; o rollout público depende da preparação e verificação OAuth descritas abaixo.

### Fases posteriores — não iniciadas

- [ ] Seletor de calendário padrão.
- [ ] Sincronização bidirecional com `events.watch` e sync tokens.
- [ ] Integração oficial com WhatsApp.
- [ ] Webhooks para Make, n8n e outros sistemas.
- [ ] Integrações com e-mail e CRMs.
- [ ] Recursos pós-reunião da Meet API, somente após validar demanda e compliance.

## Recomendação executiva

Vale criar um menu **Configurações → Integrações**, mas não transformar integrações em uma coleção de logos sem fluxo real. Para a Prospeca, a primeira entrega de maior valor é:

1. conectar a conta Google somente quando o usuário tentar agendar uma atividade;
2. criar um evento no calendário principal com prospect, responsável, horário e lembretes;
3. gerar um link exclusivo do Google Meet dentro do mesmo evento;
4. salvar o vínculo entre atividade Prospeca e evento Google;
5. permitir abrir, reagendar, cancelar e desconectar a integração.

O Google Meet **não precisa ser uma integração separada no MVP**. A Calendar API gera a conferência Meet por meio de `conferenceData.createRequest`, usando `conferenceDataVersion=1`. A Meet REST API só se justifica depois, caso a Prospeca queira criar salas sem evento, ler participantes ou processar gravações e transcrições. [Calendar: criar eventos e conferências](https://developers.google.com/workspace/calendar/api/guides/create-events) · [Meet REST API: visão geral](https://developers.google.com/workspace/meet/api/guides/overview)

## Escopo recomendado para o MVP

### Experiência do usuário

No menu de integrações, cada conexão deve mostrar estado e benefício, não apenas “conectado”:

- **Google Calendar** — “Agende contatos e reuniões sem sair da Prospeca”.
- Estado: não conectado, conectado como `email`, precisa reconectar ou erro.
- Ações: conectar, escolher calendário padrão (somente quando essa opção existir), testar conexão e desconectar.
- Explicação antes do consentimento: “A Prospeca poderá criar e atualizar somente os compromissos necessários ao seu fluxo comercial”.

O consentimento deve ser incremental: não pedir acesso ao Calendar no cadastro. O Google recomenda solicitar cada permissão no contexto em que a função é usada. [Boas práticas de OAuth](https://developers.google.com/identity/protocols/oauth2/resources/best-practices)

### OAuth e permissões

Para um SaaS web, usar o fluxo OAuth 2.0 de aplicação web no servidor, com:

- `state` imprevisível e validado no callback, para proteção contra CSRF;
- `access_type=offline`, pois lembretes, sincronização e reagendamentos acontecem sem o usuário presente;
- autorização incremental (`include_granted_scopes=true`);
- refresh token armazenado somente no backend, cifrado em repouso;
- revogação e exclusão definitiva dos tokens ao desconectar.

O Google documenta que refresh tokens para acesso offline podem expirar ou ser revogados e que a aplicação precisa tratar reconexão. [OAuth para aplicações web no servidor](https://developers.google.com/identity/protocols/oauth2/web-server) · [Boas práticas de OAuth](https://developers.google.com/identity/protocols/oauth2/resources/best-practices)

Escopo inicial sugerido:

- `https://www.googleapis.com/auth/calendar.events.owned` quando a Prospeca atuar somente em calendários que o usuário possui;
- usar `https://www.googleapis.com/auth/calendar.events` apenas se houver requisito comprovado de trabalhar também em calendários de terceiros aos quais o usuário tem acesso;
- acrescentar `calendar.calendarlist.readonly` somente quando houver um seletor de calendários;
- usar `calendar.freebusy` se, no futuro, o único requisito adicional for consultar disponibilidade;
- não solicitar o escopo amplo `calendar`, que permite ver, editar, compartilhar e excluir todos os calendários acessíveis, sem necessidade para o MVP.

A Calendar API lista os escopos disponíveis e recomenda sempre o mais restrito possível. O endpoint `events.insert` aceita `calendar.events.owned` e `calendar.events` entre os escopos autorizados. [Escopos do Calendar](https://developers.google.com/workspace/calendar/api/auth) · [`events.insert`](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert)

### Criação do evento com Google Meet

Ao criar uma reunião:

- usar `events.insert` no calendário `primary` inicialmente;
- preencher `summary`, `description`, `start`, `end`, fuso IANA e `attendees`;
- usar `sendUpdates="all"` apenas quando o usuário confirmar que quer enviar convites;
- enviar `conferenceData.createRequest.requestId` único e `conferenceDataVersion=1`;
- gerar uma conferência Meet nova para cada evento; reutilizar dados de conferência pode expor detalhes a pessoas indevidas;
- verificar `conferenceProperties.allowedConferenceSolutionTypes`, pois o calendário/conta precisa aceitar `hangoutsMeet`;
- persistir `google_event_id`, `calendar_id`, `etag`, `html_link`, `meet_uri` e o identificador interno da atividade;
- usar ID de evento próprio ou `extendedProperties.private` para idempotência e reconciliação.

A criação da conferência é assíncrona e pode retornar inicialmente com estado `pending`; a interface precisa tratar isso sem afirmar que o link já está pronto. [Criar eventos](https://developers.google.com/workspace/calendar/api/guides/create-events) · [`events.insert`](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert)

## Sincronização: quando e como evoluir

### Fase 1 — via única

No MVP, a Prospeca é a fonte da atividade e cria/atualiza/cancela o evento Google. Isso entrega valor rápido, reduz conflito de dados e não exige webhooks.

### Fase 2 — sincronização bidirecional

Quando houver demanda real para refletir mudanças feitas diretamente no Google Calendar:

1. executar uma sincronização inicial e armazenar `nextSyncToken`;
2. criar um canal `events.watch` por calendário;
3. receber notificações em webhook HTTPS;
4. ao receber o aviso, consultar as mudanças com o sync token — a notificação não traz o evento alterado no corpo;
5. armazenar o novo token;
6. ao receber HTTP `410`, descartar o token e refazer a sincronização completa;
7. renovar canais antes da expiração, pois não existe renovação automática.

Os canais têm ciclo de vida próprio; para `events.watch`, o TTL padrão é de 604.800 segundos (sete dias). Mensagens podem se sobrepor na renovação, chegar fora de ordem, ser duplicadas ou, em pequena porcentagem, não ser entregues. Portanto, o sync token é a fonte de verdade e o consumidor deve ser idempotente. [Push notifications](https://developers.google.com/workspace/calendar/api/guides/push) · [`events.watch`](https://developers.google.com/workspace/calendar/api/v3/reference/events/watch) · [Sincronização incremental](https://developers.google.com/workspace/calendar/api/guides/sync)

## Verificação do aplicativo Google

Para uso público, preparar a verificação antes de abrir a integração para a base:

- projeto Google Cloud separado para teste e produção;
- Calendar API habilitada e cliente OAuth web configurado;
- tela de consentimento com nome, domínio, e-mail de suporte e marca corretos;
- homepage pública, política de privacidade e termos em domínio próprio verificado;
- redirect URIs HTTPS exatos;
- declaração e justificativa de cada escopo;
- demonstração funcional para o processo de revisão, quando solicitada.

Aplicativos que solicitam escopos sensíveis ou restritos precisam de verificação. Um aplicativo ainda não aprovado que apresente a tela de “app não verificado” fica sujeito ao limite vitalício de 100 novos usuários. Alterar marca, redirect URI, política de privacidade ou adicionar novos escopos pode exigir nova verificação. [Conformidade OAuth](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance) · [Requisitos de verificação](https://support.google.com/cloud/answer/13464321) · [Limite de usuários OAuth](https://support.google.com/cloud/answer/15549945)

O Google publica como referências, não garantias, cerca de dois a três dias úteis para verificação de marca, dez dias úteis para escopos sensíveis e seis semanas para escopos restritos. Além disso, no modo External/Testing, autorizações com escopos além dos básicos de identidade podem expirar em sete dias; esse modo não serve como ambiente permanente de produção. [Prazos de verificação](https://support.google.com/cloud/answer/13463817) · [OAuth 2.0 do Google](https://developers.google.com/identity/protocols/oauth2)

### Meet REST API: evitar no início

Se a Prospeca futuramente usar a Meet REST API:

- `meetings.space.created` permite criar e administrar espaços criados pelo app, mas é classificado como sensível;
- `meetings.space.readonly` também é sensível;
- leitura de gravações/transcrições com `drive.readonly` ou `drive.meet.readonly` é restrita;
- ao armazenar ou transmitir dados de escopo restrito em servidores, o Google exige avaliação de segurança, além da verificação reforçada.

Por isso, transcrição e análise pós-reunião devem ser uma fase posterior, com justificativa comercial e orçamento de compliance próprios. [Escopos da Meet REST API](https://developers.google.com/workspace/meet/api/guides/authenticate-authorize)

Eventos de presença, gravação e transcrição usam a Google Workspace Events API com Google Cloud Pub/Sub, não o webhook simples do Calendar. Isso adiciona outro ciclo de assinaturas, entrega e renovação, reforçando a recomendação de deixar o pós-reunião fora do MVP. [Workspace Events API](https://developers.google.com/workspace/events) · [Eventos do Google Meet](https://developers.google.com/workspace/events/guides/events-meet)

## Quotas, custos e limites em agosto de 2026

Para projetos Google Cloud sujeitos ao modelo atualizado desde 1º de maio de 2026, a documentação informa:

- 10.000 requisições por minuto por projeto;
- 600 requisições por minuto por usuário por projeto;
- até 1.000.000 de requisições por dia por projeto sem cobrança adicional;
- uso padrão da Calendar API sem custo adicional;
- cobrança acima do limite diário planejada para mais tarde em 2026, com detalhes ainda não publicados e aviso mínimo de 90 dias.

Esses números devem ser confirmados novamente antes do lançamento e considerados variáveis de fornecedor. O backend precisa implementar exponential backoff para `403/429`, distribuir tarefas no tempo e preferir push notifications a polling. [Limites e preços do Calendar](https://developers.google.com/workspace/calendar/api/guides/quota) · [Tratamento de erros](https://developers.google.com/workspace/calendar/api/guides/errors)

Se a Meet REST API for adotada depois, ela possui quotas próprias — inclusive limites menores para escrita e `spaces.create` — que precisam entrar no capacity planning. [Limites da Meet REST API](https://developers.google.com/workspace/meet/api/guides/limits)

## Riscos que precisam entrar no desenho

- **Segurança de tokens:** refresh tokens dão acesso duradouro; cifrar, limitar acesso por serviço, auditar uso e nunca expor ao frontend.
- **Revogação:** uma conexão pode deixar de funcionar a qualquer momento; mostrar “Reconectar” e não perder a atividade local.
- **Convites indesejados:** nunca enviar convite automaticamente antes da confirmação explícita do usuário.
- **Duplicidade:** retries podem ocorrer depois de o Google já ter criado o evento; usar idempotência e vínculo local.
- **Conflitos:** na sincronização bidirecional, definir claramente qual sistema vence por campo e registrar origem/horário da alteração.
- **Privacidade/LGPD:** explicar dados acessados, finalidade, retenção e exclusão; não importar toda a agenda se o recurso não precisa disso.
- **Multi-tenant:** a conexão deve pertencer ao usuário dentro da organização, e não ser um token global do workspace da Prospeca.
- **Dependência de fornecedor:** acompanhar mudanças de quota, preço, escopos e política, com feature flag para desativar a integração sem derrubar o CRM.

## Integrações adjacentes com maior valor comercial

Ordem recomendada para a Prospeca:

1. **Google Calendar + Meet** — transforma oportunidade em reunião e evita copiar dados manualmente.
2. **WhatsApp oficial** — registrar conversas, modelos e resultados; é mais central ao público da Prospeca do que uma biblioteca ampla de integrações.
3. **E-mail (Google/Microsoft)** — enviar e registrar contato a partir do lead; começar por envio e tracking mínimo, sem importar toda a caixa postal.
4. **Webhooks + Zapier/Make/n8n** — uma única interface abre muitos destinos com menor custo de produto.
5. **CRMs (HubSpot, Pipedrive e RD Station)** — exportar oportunidades qualificadas e sincronizar estágio para clientes já maduros.
6. **Meet pós-reunião** — participantes, transcrição, resumo e próximas ações somente após validar adoção e compliance.

A robustez percebida vem menos da quantidade de integrações e mais de três fluxos confiáveis: **prospectar → contatar → agendar**, com histórico e estado sincronizados.

## Sequência de entrega sugerida

### Etapa 1 — fundação

- página de integrações com status e desconexão;
- modelo seguro para credenciais, escopos, expiração e erros;
- OAuth Google em projeto de teste e produção;
- auditoria e política de exclusão.

### Etapa 2 — Calendar + Meet MVP

- conectar no contexto de “Agendar reunião”;
- criar, atualizar e cancelar evento;
- gerar Meet único;
- confirmação visual e link para abrir no Calendar;
- métricas: conexão iniciada/concluída, reunião criada, erro e desconexão.

### Etapa 3 — confiabilidade

- retries idempotentes e tratamento de token revogado;
- reconciliação manual;
- verificação OAuth concluída antes do rollout público;
- rollout gradual por feature flag.

### Etapa 4 — sincronização e ecossistema

- webhooks e sync tokens, apenas se usuários editarem eventos fora da Prospeca;
- WhatsApp/e-mail e API de webhooks;
- CRMs conforme demanda dos planos pagos;
- Meet REST API apenas para recursos pós-reunião validados.

## Decisão recomendada

Construir o menu **Integrações** agora faz sentido como fundação do produto, mas a primeira conexão deve ser estreita e completa: **Google Calendar com geração de Google Meet**. Ela deve nascer ligada a uma ação comercial concreta — agendar o próximo passo de uma oportunidade — e não como um item isolado de configuração. Depois de provar uso, a Prospeca pode adicionar sincronização bidirecional e integrações de comunicação sem carregar desde já o custo de segurança e manutenção de uma plataforma de integrações genérica.
