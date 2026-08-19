# UI Smoke — Discovery Intelligence V2 (roteiro manual)

> Para o usuário executar na UI real com o login dele. Sem automação, sem
> custo além de 1 busca pequena (~US$0.03). Estado atual: dev Supabase com
> 65/65 migrations aplicadas e 11 edge functions deployadas.

## 1. Pré-requisitos

- App rodando em modo real: `localhost:3000` com `VITE_DATA_MODE=real`.
- Login com um usuário que tenha organização ativa.
- Nenhuma configuração extra — tudo já está no dev.
- **Custo esperado**: 1 busca pequena ≈ US$0.03 (1 página Google). Só faça
  1 busca com raio curto; não clique em "Atualizar dados" (force refresh).

## 2. Busca de teste

- Nicho: **"barbearia"** (qualquer nicho serve).
- Local: **São Paulo** (ou sua cidade).
- Raio: **~2000 m**. Sem filtros extras de presença.

## 3. Passo a passo por tela

### 3.1 Antes de buscar (F7 — estimativa)

1. Preencha nicho + localização + raio e clique em **Buscar**.
2. **Esperado**: no bloco de progresso, junto de "Criando busca…" ou na etapa
   seguinte, aparece a linha
   `Estimativa: ~20–20 resultados · US$ 0.0320–0.0320` (números variam com o
   raio; pode aparecer "(cache — custo zero)" se a região já foi buscada).
3. **FALHA se**: a busca dispara sem a linha de estimativa (flag ou function
   antiga) — reporte.

### 3.2 Mapa / Lista (F2/F3 — score V2 + confiança)

1. Aguarde a busca completar (~5–15s). O mapa/lista carrega os resultados.
2. **Esperado**:
   - Cada card/linha tem **score numérico** (0–100) e temperatura (Quente/
     Morno/Frio).
   - Ao lado do badge "provisório" (quando presente), aparece o badge de
     **confiança**: "confiança média" ou "confiança alta" (borda/tonalidade
     diferente por banda).
3. **FALHA se**: resultados mostram score mas **nenhum badge de confiança**
   depois de ~1 min — indica flag `v2ScoringInDiscovery` desligada ou score
   ainda v3.0.0 (cache antigo do browser — veja Troubleshooting).

### 3.3 Drawer da empresa (F2/F3 — inteligência explicável)

1. Clique em uma empresa (mapa ou lista) para abrir o drawer.
2. **Esperado**, na aba "Oportunidade":
   - Card **"Inteligência de oportunidade"** com score grande, "confiança X%",
     versão `v1.1.0` e **7 componentes** com barras (Lacuna digital,
     Contatabilidade, Reputação, Qualidade do negócio, Aderência à missão,
     Território, Atualidade).
   - **Sinais** como chips coloridos por severidade (vermelho = alta,
     amarelo = média, cinza = baixa). **Passe o mouse** sobre um chip:
     tooltip com `evidência · confiança % · origem` (ex.: "sem site próprio
     identificado nos dados de descoberta · confiança 90% · google_places").
   - "Sinais de intenção" (se houver) no topo da aba.
3. **FALHA se**: card mostra "Aderência à missão" e "Território" sempre em
   50/100 e confiança sempre 60% mesmo após ~1 min (score antigo); ou chips
   sem tooltip de evidência.

### 3.4 Aba Regiões (F4 — território server-side)

1. Troque a visão para **Regiões** (TopNav).
2. **Esperado**: cards por bairro/cidade com **N empresas, quentes, score
   médio, % sem site**; no topo, insights comparativos com
   "· confiança X%" quando a amostra permite.
3. **FALHA se**: vazio permanente mesmo com 10+ empresas carregadas — a fila
   pode ainda não ter rodado a `territory-analysis` (recarregue após ~1 min).
   Regiões com poucas empresas (< 3) não geram insights — comportamento
   honesto, não é falha.

### 3.5 Seção "Cadastro público (CNPJ)" (F5 — BrasilAPI resiliente)

1. Abra uma empresa no drawer → aba "Visão geral" → role até a seção
   **"Cadastro público (CNPJ)"**.
2. **Caso A — CNPJ válido mas inexistente** (ex.: `11.222.333/0001-81`):
   - **Esperado**: mensagem "CNPJ válido, sem cadastro encontrado na base
     pública. Empresa sem cadastro resolvido é normal…" — **não** é erro.
3. **Caso B — CNPJ real** (de uma empresa que você conheça):
   - **Esperado**: razão social, CNPJ, CNAE (código + descrição), situação
     cadastral e "Consultado em <data>" aparecem; o card fica preenchido.
4. **FALHA se**: erro global no drawer, loading infinito, ou a consulta
   bloquear o resto da empresa — a fonte deve falhar **sem derrubar nada**
   ("Fonte de cadastro indisponível no momento…" é o comportamento certo).

### 3.6 Sininho (F6 — notificações por sinais de intenção)

1. Tenha um lead **quente** (temperatura Quente) no funil com um sinal
   (ex.: sem site / reputação crítica).
2. Abra o **sininho**: a notificação aparece com ícone de tendência e badge
   **"SINAL"** (fundo amarelo).
3. **FALHA se**: você sabe que há lead quente com sinal e nada aparece — veja
   Troubleshooting (gate `hot`). Se o lead não é quente, não notificar é o
   comportamento correto.

### 3.7 Painel Admin (opcional — F1/F7)

1. Rota `/app/admin` → aba/área **Processamento**.
2. **Esperado**: contadores da fila (Na fila/Processando/Concluídos/Falhas/
   Dead-letter), tabela de jobs com **duração** e a seção **"Métricas por
   tipo de job"** (total, concluídos, falhas, duração média, custo est.).
3. **FALHA se**: 403 — seu usuário não é `platform_admin` (esperado para
   usuários comuns; a seção é só para admins).

## 4. O que a fila faz por baixo (contexto)

- A busca (Google) completa rápido; **score V2, sinais e território chegam
  depois**, via worker (`process-jobs`), em segundos/minutos.
- Por isso os dados "amadurecem": logo após a busca o badge pode estar
  "provisório" e a confiança em 60%; recarregue a lista/drawer após ~30–60s
  e veja o score subir e o badge de confiança aparecer (média/alta).
- O mesmo vale para Regiões: a primeira carga pode cair no cálculo local do
  navegador; o servidor substitui em seguida.

## 5. Checklist final

| Item                                            | Esperado                                            | OK / Falha |
| ----------------------------------------------- | --------------------------------------------------- | ---------- |
| Estimativa no progresso (antes/durante a busca) | linha "Estimativa: ~X–Y · US$ A–B"                  |            |
| Mapa/Lista: score + badge de confiança          | badge média/alta ao lado de "provisório"            |            |
| Drawer: card de inteligência                    | 7 componentes, versão v1.1.0, confiança %           |            |
| Drawer: sinais com severidade + tooltip         | chips coloridos; tooltip evidência·confiança·origem |            |
| Regiões: agregados do servidor                  | contagens, score médio, % sem site, insights        |            |
| CNPJ inexistente (válido)                       | mensagem honesta "sem cadastro… é normal"           |            |
| CNPJ real                                       | razão social/CNAE/situação preenchidos              |            |
| Sininho: sinal de intenção                      | badge "SINAL" para lead quente com sinal            |            |
| Admin: jobs + métricas (se admin)               | duração, custo, métricas por tipo                   |            |

## 6. Troubleshooting curto

- **Sem badge de confiança na lista**: (1) espere ~1 min e recarregue
  (worker pode ainda estar scoreando); (2) cheque a flag
  `v2ScoringInDiscovery` (`apps/web/src/lib/feature-flags.ts`, default
  `true`); (3) hard-refresh para limpar cache de dados antigos.
- **Sininho sem notificação de sinal**: o gate exige lead com temperatura
  **hot**; se o lead é warm/cold, é comportamento esperado. Confirme a
  temperatura no card do lead.
- **Jobs presos** (admin): o sweeper `recover-stuck-jobs` roda a cada 5 min
  (`cron.job`); se suspeitar, confirme no SQL Editor:
  `select cron.jobname, schedule from cron.job where jobname = 'recover-stuck-jobs';`
- **CNPJ indisponível**: a BrasilAPI pode estar fora — a mensagem honesta
  "Fonte de cadastro indisponível no momento…" aparece; os demais dados da
  empresa continuam normais. Tente de novo mais tarde.

## 7. Cleanup

Não é necessário — a busca e os dados ficam na organização do usuário (dados
reais, sem sujeira de teste). O custo total esperado é de ~US$0.03.
