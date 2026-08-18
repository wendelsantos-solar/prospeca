# Prospeca — Diagnóstico de Produto

> Auditoria holística (dev · design/UX · copy · infra). Objetivo: dar visibilidade
> sobre o nível atual do produto e apontar o que melhorar, o que remover e em que
> ordem atacar. Data: 2026-08-13.

---

## 1. Resumo executivo

O **alicerce técnico é forte** — domínio puro e determinístico, score explicável,
multi-tenancy com RLS, testes cobrindo o núcleo. O **valor central** (encontrar
negócios com baixa presença digital = oportunidade de vender serviço) está
implementado de ponta a ponta.

O **gargalo hoje é a camada de uso (UX)**: há atrito na busca, superfícies
redundantes e detalhes de acabamento que fazem o produto "não parecer
profissional". Nada disso é estrutural — são correções de produto, não de
arquitetura. O momento é de **polir, remover e priorizar**, não de reescrever.

---

## 2. Visão do produto (o "norte")

> _"Pesquiso um nicho — ex.: barbearia — e o produto me aponta, numa região, quais
> barbearias têm baixa presença digital e valem contato, e **por quê**."_

A promessa: **transformar descoberta em negócio** — da busca até o primeiro
contato (WhatsApp/e-mail), com o score explicando cada decisão.

---

## 3. Usabilidade — problemas prioritários

### 🔴 3.1 Região "travada" (você relatou)

**Sintoma:** não consegue trocar a região — ela fica fixa no seu lugar/última busca.

**Causas encontradas no código:**

- **Só 8 cidades fixas** (`CITY_SUGGESTIONS` em `lib/constants.ts`). Fora delas, o
  usuário depende de geocodificar texto digitado, que **falha em modo demo** e
  deixa a pessoa sem opção.
- **Hidratação da última localização** (`lastLocation` → `setDraft`) re-popula o
  campo toda vez, dando a sensação de "já está definido e não sai".
- **`coords` inicial é `{lat: 0, lng: 0}`** (oceano, perto da África) — se nada
  for escolhido, o mapa centraliza num ponto errado.
- **Três lugares diferentes para mexer em região** (ver 3.2) — o usuário não
  acha onde trocar.

**Ação:** consolidar a seleção de região em **um único lugar**, com busca livre
por cidade/bairro/CEP (com fallback que funciona offline) e remover o estado
inicial (0,0).

### 🟠 3.2 Superfícies de busca redundantes (confunde)

Existem **três** pontos de entrada que fazem a mesma coisa:

1. **Wizard de onboarding** ("Quem você quer encontrar?" → tipo de empresa → região).
2. **Formulário lateral** (`SearchForm`): `MissionInput` (linguagem natural) + nicho + região + raio + presença.
3. **Tela inicial** ("Começar uma busca" + sugestões prontas).

**Ação:** um único fluxo de busca. Sugestões prontas podem virar "atalhos" que
preenchem o formulário único, não um caminho paralelo.

### 🟠 3.3 Dois modos de input de busca (NL vs. estruturado)

`MissionInput` ("barbearias sem site em Campo Grande") e os campos estruturados
(nicho + região) coexistem. O usuário pode não saber qual usar, e os dois
escrevem no mesmo draft.

**Ação:** decidir **um** como principal (recomendo o estruturado, que é
previsível e não depende de interpretação), e manter o NL como atalho opcional
— não como segundo formulário no mesmo painel.

### 🟡 3.4 Heatmap (corrigido nesta sessão — validar)

Corrigidos: deslocamento (coordenada), vazamento do raio (clip), "campo" uniforme
(pontos localizados) e agora o canvas ancorado à viewport. **Ainda precisa da sua
validação visual** (pan + zoom + clique).

---

## 4. Engenharia — avaliação

**Pontos fortes:**

- Domínio puro (`packages/domain`) sem dependências de framework — testável e
  determinístico (334+ testes verdes).
- Score v2 multi-componente, **explicável** (breakdown + sinais nomeados) — o
  "porquê" já existe em dados, só falta expor em mais lugares.
- Multi-tenancy correto (RLS + `is_organization_member`), separação
  discovery (places) × CRM (leads).
- Enriquecimento idempotente/aditivo com guarda SSRF.

**Riscos / lacunas:**

- **Fila sem worker**: `jobs` é observável mas o processamento é
  `functions.invoke` encadeado. Se o volume crescer, entra em BullMQ (já
  abstraído atrás de `JobQueue`). Sem pressa.
- **Rate-limit** nas functions novas (score-company, lookup-cnpj) — revisar
  quotas antes de abrir uso real.
- **CNPJ (CNAE)** ainda depende de fonte cadastral real para o `cnaeIntelligence`.
- **E2E** cobre fluxo de descoberta, mas não a **correção visual** do heatmap
  (isso é validação manual sua).

---

## 5. Design / UI / UX — avaliação

**O que já está bom:** componentes consistentes (shadcn/tailwind), dark mode,
densidade de tabela, estados vazio/erro/loading, legenda do mapa.

**O que falta pra "parecer profissional":**

- **Hierarquia da busca**: o formulário lateral tem 6+ controles empilhados
  (missão, nicho, região, raio, presença, botão). Precisa de **agrupamento
  visual** (passo 1: o quê → passo 2: onde → passo 3: quão longe).
- **Feedback de "região escolhida"**: mostrar claramente no mapa um pin + rótulo
  da região ativa (hoje é ambíguo).
- **Empty states com ação**: quando "nada no raio", sugerir "aumentar raio" em
  vez de só texto.
- **Microcopy consistente**: mistura de "busca/buscar/pesquisa" ao longo do app.

---

## 6. Copy / conteúdo

- Termos oscilam: **"busca" / "pesquisa" / "radar" / "descobrir"** para a mesma
  coisa. Escolher um vocabulário e padronizar.
- "Radar" (marca) vs. "raio de busca" (conceito) — precisa de distinção clara.
- O score precisa de **uma frase didática** ("por que 78?"), não só números —
  o breakdown já existe, falta traduzi-lo em linguagem de vendedor.

---

## 7. Infra / Ops

- Supabase (Postgres 17 + PostGIS) + Edge Functions (Deno) — adequado ao estágio.
- Migrations e functions **deployadas** no remoto (ref `zxneketqrapvbxyqewar`).
- **Pendências reais:** credenciais de provider (CNPJ/CNAE, social, reputação),
  rate-limit por tenant, observabilidade de jobs em produção (hoje via painel admin).

---

## 8. O que **remover / simplificar**

1. **Superfícies de busca redundantes** → manter 1 (estruturado) + atalhos.
2. **MissionInput como formulário paralelo** → virar atalho opcional (ou remover
   até o LLM parser ter valor real).
3. **Sugestões de busca fixas na home** → manter como atalhos do formulário único.
4. Qualquer **flag V2 desligada que não vai virar logo** (ex.: `cnaeIntelligence`)
   → deixar documentada, não acumular código morto.

---

## 9. Roteiro priorizado (etapas)

| Etapa                    | Foco                                                                                            | Por quê primeiro                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **P1 — Busca**           | Região livre (busca real + fallback), remover (0,0), **1 fluxo de busca**, agrupar o formulário | É o coração do produto; sem isso nada do resto importa |
| **P2 — Heatmap**         | Validar visual (você), polir clique→"porquê", legenda com dados                                 | É o diferencial visual que você pediu                  |
| **P3 — Explicabilidade** | Frase didática do score + "por quê" no card e no popup                                          | Vende o valor: "você entende cada ponto"               |
| **P4 — Acabamento**      | Microcopy padronizada, empty states acionáveis, feedback de região no mapa                      | Transforma em "produto profissional"                   |
| **P5 — Provider/Infra**  | CNPJ/CNAE real, rate-limit, worker (BullMQ) se precisar                                         | Só quando volume justificar                            |

---

## 10. Perguntas pra eu fechar com você

1. A região: você quer **busca livre por cidade/bairro** (digitar e achar) ou
   **lista de cidades pré-definidas** expandida?
2. O fluxo de busca ideal pra você é **um formulário estruturado** (nicho →
   região → raio) ou **uma frase em linguagem natural**?
3. Qual das 3 superfícies de busca você acha que deveria ser **a** principal?

Respondendo essas 3, eu já transformo a etapa **P1** em tarefas concretas e
implemento.
