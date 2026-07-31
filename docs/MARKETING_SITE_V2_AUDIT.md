# Marketing Site V2 — Audit

**Branch de origem:** `feat/saas-production-readiness` (6fd985f)
**Branch criada:** `feat/marketing-site-v2`
**Working tree inicial:** clean
**Dependências de outras branches:** Nenhuma (Design System V2 já reside em `feat/saas-production-readiness`, esta branch deriva dela)

---

## 1. Framework & Routing

| Item                  | Status                                                    | Detalhes                                                                                                                    |
| --------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Framework             | ✅ TanStack Start + React 19                              | SSR habilitado (`ssr: true`)                                                                                                |
| Roteador              | ✅ TanStack Router (file-based)                           | `routeTree.gen.ts` auto-gerado                                                                                              |
| Estrutura pública     | 7 rotas                                                   | `/`, `/precos`, `/cadastro`, `/login`, `/termos`, `/privacidade`, `/recuperar-senha`, `/redefinir-senha`                    |
| Estrutura autenticada | 8 rotas sob `/app`                                        | `/app/mapa`, `/app/painel`, `/app/kanban`, `/app/hoje`, `/app/agenda`, `/app/historico`, `/app/configuracoes`, `/app/admin` |
| Rota inicial (`/`)    | ✅ Landing para anônimo, redirect para app se autenticado | `useEffect` em `routes/index.tsx`                                                                                           |
| Auth gate             | ✅                                                        | `/app` verifica sessão em modo real, redireciona para `/login`                                                              |
| Tipo de roteamento    | Client-side SPA + SSR                                     | TanStack Start com `scrollRestoration: true`                                                                                |

## 2. Problemas encontrados nos prints atuais

### Hero & Header

- **Header com `max-w-6xl`** — estreito demais para 1440px+; o container principal é 1120px
- **Hero `pt-16 md:pt-24`** — pode ser insuficiente com header sticky de 64px; título parcialmente encoberto em notebooks
- **Headline `text-3xl md:text-5xl`** — a escala máxima de 48px é modesta para hero de SaaS; referências usam 52-64px
- **Mockup abstrato** — `ProductPreview` usa círculos e dots em vez do produto real
- **Container do hero estreito** — `max-w-6xl` limita demonstrações a 1120px

### Layout & Espaçamento

- **Containers consistentes em `max-w-6xl` (1120px)** — adequado para texto mas insuficiente para demonstrações de produto (precisam de `max-w-7xl` ou showcase wider)
- **`Section` base** — `py-16 md:py-24` (64px/96px). Ritmo ok mas falta variação — muitas seções com mesmo padding
- **Espaçamento entre seções homogêneo** — sem alternância de densidade, o que torna o scroll monótono
- **Sem tokens de layout** — `max-w-6xl` hardcoded em todos os componentes

### Mapa

- **Demonstração abstrata** — usa background pattern + círculo + dots coloridos, sem realismo
- **Nenhuma representação do mapa real** — sem Google Maps, Leaflet, ou screenshot
- **Sem atribuição de fonte de dados**

### Pipeline

- **5 botões estáticos** — sem cards, sem dados de lead, sem interatividade visual
- **Não demonstra o fluxo real** — apenas nomes de estágios

### Preços

- **`PricingTeaser` mostra 3 cards simples** — sem recursos, sem diferenciação clara
- **Cards sem destaque visual suficiente** — sem ícones, sem CTAs distintos
- **Página `/precos`** — bem estruturada com toggle mensal/anual, 5 planos, tabela comparativa

### FAQ

- **Usa `<details>/<summary>` nativo** — funciona, mas sem ícone de seta animado, sem transição suave
- **Largura `max-w-2xl`** — adequada

### Fluxo de valor (TrustStrip)

- **5 ícones com labels e descrições** — estrutura ok mas ícones pequenos (`h-4 w-4`)
- **Responsivo com grid 2→3→5 colunas**

### Mockups

- **`ProductPreview`** — composição abstrata, não é screenshot nem componente real
- **Mapa** — dots em fundo com pattern, sem realismo
- **Score** — card estático com fatores, ok
- **Pipeline** — 5 botões sem cards de lead

## 3. Problemas específicos por componente

### MarketingHeader

- `max-w-6xl` — estreito
- `h-16` — altura ok (64px)
- `bg-background/85 backdrop-blur` — transparência ok
- Sem estado autenticado (mostra sempre "Entrar" + "Começar gratuitamente")
- Menu mobile básico, sem transição animada
- Navegação: 6 itens, muito para notebooks menores

### HeroSection

- Headline "Encontre empresas que precisam exatamente do serviço que você vende." — palavra "exatamente" adiciona ênfase mas alonga
- `pt-16 md:pt-24` no section, sem considerar altura do header
- Sem `scroll-margin-top` nas âncoras

### MapSection

- Usa dots posicionados com % — sem realismo
- Círculo representa raio de busca — conceito ok, execução pobre

### PipelineSection

- 5 colunas com texto apenas, sem cards simulando leads reais
- Sem representação do kanban real

## 4. O que funciona bem

- **SEO** — SSR real, meta tags por rota, canonical, OG, Twitter Card
- **UTM** — captura em sessionStorage, first-touch wins, sobrevive navegação
- **Analytics** — `track()` com tipagem forte, fire-and-forget, não quebra o app
- **Billing plans** — do backend (`billing_plans` table), sem hardcode
- **Founder offer** — condicional, sem números inventados
- **Testimonials** — honesto (sem depoimentos falsos)
- **CaseStudy** — desligado por feature flag
- **Auth flow** — cadastro preserva `plan` param, invitation token
- **Design System V2** — tokens OKLCH, scale tipográfica nomeada, sombras, z-index, motion
- **Tailwind v4** — `@theme inline` no CSS, sem config separada
- **Sem links quebrados** — footer só linka rotas existentes

## 5. Gaps de arquitetura

### Rotas públicas faltantes

- `/para-agencias` — conteúdo existe como âncora `#agencias`, não como rota própria
- `/contato` — não existe (usa dialog `SalesContactForm`)
- `/entrar` — mapeado como `/login` (TanStack Router file-based usa nome do arquivo)
- Rotas futuras (`/recursos`, `/como-funciona`, `/casos`, `/blog`, `/guias`) — não existem

### Redirect indevido

- Usuário autenticado em `/` é redirecionado para `/app/mapa` via `useEffect` — **comportamento atual, ok mas impede autenticado de ver landing**
- Sem parâmetro `returnTo` após login — hardcoded `navigate({ to: "/app/mapa" })`

### Header para autenticados

- `MarketingHeader` não tem lógica de autenticação — sempre mostra CTAs de visitante
- Na landing, usuário autenticado vê "Entrar" e "Começar gratuitamente" mesmo já logado

## 6. Design System V2 — uso atual nos componentes de marketing

| Token      | Uso                                                                                          |
| ---------- | -------------------------------------------------------------------------------------------- |
| Cores      | ✅ Todos componentes usam tokens (`bg-surface`, `text-foreground`, etc.)                     |
| Tipografia | ⚠️ Componentes de marketing usam `text-sm`/`text-lg`/`text-3xl` ad-hoc, não a escala nomeada |
| Radius     | ✅ `rounded-xl` consistente                                                                  |
| Sombras    | ✅ `shadow-card` em cards                                                                    |
| Ícones     | ✅ `lucide-react` exclusivamente, `h-4 w-4` padrão                                           |
| Z-index    | ✅ `z-40` no header                                                                          |

## 7. Performance

- ✅ SSR com TanStack Start
- ✅ Lazy loading de landing (`lazy(() => import(...))`)
- ✅ Preconnect origins configurado
- ✅ Sem Google Maps carregado na landing (mapa é abstrato)
- ⚠️ `ProductPreview` é componente React, não imagem — renderiza no cliente
- ⚠️ Sem lazy loading para imagens (não há imagens ainda)

## 8. Acessibilidade

- ✅ skip link ausente (a adicionar)
- ✅ landmarks: `<header>`, `<main>`, `<footer>`, `<nav>`, `<section>`
- ✅ aria-label em botões de menu mobile
- ⚠️ FAQ usa `<details>` — nativo, mas sem animação de transição
- ⚠️ Contraste: tokens OKLCH validados
- ⚠️ Sem reduced-motion queries aplicadas

## 9. Resumo de ações necessárias

### Crítico (bloqueia qualidade)

1. Corrigir hero — headline maior, padding-top suficiente, mockup real
2. Substituir mockups abstratos por demonstrações baseadas no produto
3. Criar dados demo centralizados e reutilizáveis
4. Adicionar tokens de layout (containers narrow/default/wide/showcase)
5. Corrigir espaçamento vertical com tokens de section-space

### Importante (bloqueia profissionalismo)

6. Header com estado autenticado
7. Menu mobile com transição
8. Seção de mapa com demonstração realista
9. Pipeline com cards simulando leads
10. Pricing teaser com mais informações
11. FAQ com ícones de expand/colapse e transição
12. `scroll-margin-top` nas âncoras

### Desejável

13. Criar `/para-agencias` como rota própria
14. Criar `/contato` como rota própria
15. Adicionar skip link
16. Respeitar `prefers-reduced-motion`
17. Otimizar imagens (quando existirem)
