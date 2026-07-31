# Marketing SEO — Radar Local

Configuração de SEO para o site público.

## Arquitetura

- **SSR real** — TanStack Start com `ssr: true`
- **Meta tags por rota** — cada `createFileRoute` define `head()` com title, description, OG
- **JSON-LD** — structured data `SoftwareApplication` em `__root.tsx`
- **Canonical** — cada rota pública define `<link rel="canonical">`

## Metadados por página

| Rota             | Title                                                                  | Description                                             |
| ---------------- | ---------------------------------------------------------------------- | ------------------------------------------------------- |
| `/`              | Radar Local — Encontre empresas que precisam do serviço que você vende | Pesquise empresas locais por nicho e região...          |
| `/precos`        | Preços — Radar Local                                                   | Planos do Radar Local: comece de graça...               |
| `/para-agencias` | Para Agências — Radar Local                                            | Prospecção local em equipe com Pipeline colaborativo... |
| `/contato`       | Contato — Radar Local                                                  | Entre em contato com o Radar Local...                   |
| `/cadastro`      | Criar conta — Radar Local                                              | (herda do root)                                         |
| `/login`         | Entrar — Radar Local                                                   | (herda do root)                                         |

## Índices

### Indexáveis

- `/` — landing page
- `/precos` — página de preços
- `/para-agencias` — página de agências
- `/contato` — página de contato
- `/privacidade` — política de privacidade
- `/termos` — termos de uso

### Não indexáveis (recomendado)

- `/app/*` — aplicação autenticada
- `/login` — página de login
- `/cadastro` — página de cadastro
- `/recuperar-senha` — recuperação de senha
- `/redefinir-senha` — redefinição de senha

## Sitemap

`public/sitemap.xml` — gerado manualmente.
**ATENÇÃO:** Usa domínio placeholder `seudominio.com`. Substituir pelo domínio real
antes do lançamento.

Para atualizar: editar `public/sitemap.xml` com as URLs corretas.

## Robots

`public/robots.txt` — permite indexação das páginas públicas, bloqueia `/app`.

## Open Graph

Todas as páginas públicas têm:

- `og:title`
- `og:description`
- `og:type: website`

Imagens OG (`og:image`) ainda não configuradas — requer asset visual de marca
(1200×630px).

## Twitter Card

Configurado: `summary_large_image` (sem imagem ainda).

## Headings

Hierarquia semântica:

- `h1` — um por página (hero headline)
- `h2` — títulos de seção
- `h3` — subtítulos dentro de cards/seções

## Alt text

- Imagens: a adicionar quando existirem assets visuais
- Mapas decorativos: `role="img"` com `aria-label`
- Ícones: `aria-hidden="true"` (são decorativos, texto acompanha)

## Performance (Core Web Vitals)

- LCP: otimizado (hero tipografia + demo CSS, sem imagens pesadas)
- FID/INP: sem JS bloqueante na landing
- CLS: sem layout shift (dimensões explícitas, font-display swap)

## Checklist pré-lançamento

- [ ] Substituir `seudominio.com` no sitemap pelo domínio real
- [ ] Adicionar `og:image` (1200×630px)
- [ ] Configurar Google Search Console
- [ ] Verificar indexação no Google
- [ ] Adicionar `robots.txt` para bloquear `/app/*` se desejado
- [ ] Validar com Google Rich Results Test (JSON-LD)
- [ ] Configurar domínio canônico (www vs não-www)
