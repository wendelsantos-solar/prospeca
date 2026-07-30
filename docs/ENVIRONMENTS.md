# Ambientes — Radar Local

**Data:** 2026-07-30
**Versão:** 1.0

---

## Ambientes

### Local (development)

| Propriedade | Valor |
|------------|-------|
| **Propósito** | Desenvolvimento local |
| **Supabase** | Local (Docker via Supabase CLI) |
| **URL** | `http://127.0.0.1:3000` (frontend) |
| **API** | `http://127.0.0.1:54321` |
| **Studio** | `http://127.0.0.1:54323` |
| **Database** | PostgreSQL 17 local (porta 54322) |
| **Modo de dados** | `VITE_DATA_MODE=demo` (padrão) ou `real` |
| **Google APIs** | Server key do `.env.local` |
| **Auth** | Supabase Auth local (`enable_confirmations = false`) |
| **E-mails** | Inbucket local (`http://127.0.0.1:54324`) |
| **Config** | `.env.local` (não commitado) |
| **Template** | `.env.example` |

### Staging

| Propriedade | Valor |
|------------|-------|
| **Propósito** | Validação pré-produção, testes de integração |
| **Supabase** | Supabase Cloud — projeto staging separado |
| **URL** | `https://staging.radarlocal.com.br` (a definir) |
| **Modo de dados** | `VITE_DATA_MODE=real` |
| **Google APIs** | Chave de staging (separada da produção) |
| **Auth** | `enable_confirmations = true` |
| **E-mails** | Provedor real com suppression/ sandbox |
| **Deploy** | Automático via CI/CD (branch `main` ou `staging`) |
| **Observações** | Banco separado, chaves externas separadas |

### Production

| Propriedade | Valor |
|------------|-------|
| **Propósito** | Produção comercial |
| **Supabase** | Supabase Cloud — projeto production |
| **URL** | `https://app.radarlocal.com.br` (a definir) |
| **Modo de dados** | `VITE_DATA_MODE=real` |
| **Google APIs** | Chave de produção |
| **Auth** | `enable_confirmations = true` |
| **E-mails** | Provedor real |
| **Deploy** | Manual ou via CI/CD com aprovação |

---

## Variáveis de ambiente

### Frontend (`apps/web/.env`)

| Variável | Local | Staging | Production | Notas |
|----------|-------|---------|------------|-------|
| `VITE_DATA_MODE` | `demo` | `real` | `real` | `demo` usa mocks |
| `VITE_SUPABASE_URL` | `http://127.0.0.1:54321` | URL staging | URL prod | |
| `VITE_SUPABASE_ANON_KEY` | anon key local | anon key staging | anon key prod | |
| `VITE_GOOGLE_MAPS_BROWSER_KEY` | key local | key staging | key prod | Restrita por domínio |
| `VITE_MAP_TILE_URL` | OSM (padrão) | OSM | OSM | Opcional |
| `VITE_MAP_ATTRIBUTION` | OSM (padrão) | OSM | OSM | Obrigatório |

### Edge Functions (Supabase secrets)

| Secret | Notas |
|--------|-------|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — **nunca expor** |
| `GOOGLE_MAPS_SERVER_KEY` | Chave server do Google — **nunca expor** |
| `CORS_ORIGINS` | Origens permitidas (ex: `https://app.radarlocal.com.br`) |
| `APP_URL` | URL pública da aplicação |
| `STRIPE_SECRET_KEY` | (Futuro) Chave secreta do Stripe |
| `SENTRY_DSN` | (Futuro) DSN do Sentry |
| `SMTP_*` | (Futuro) Configuração de e-mail |

---

## Configuração de ambiente

### Criar staging

1. Criar projeto Supabase Cloud separado para staging
2. Configurar secrets no dashboard do Supabase
3. Aplicar migrations (`supabase db push`)
4. Configurar GitHub Actions para deploy automático em staging
5. Verificar Google APIs com chave de staging

### Boas práticas

- **Nunca** usar secrets de produção em staging/local
- **Nunca** usar service role key no frontend
- **Sempre** verificar `CORS_ORIGINS` para cada ambiente
- **Sempre** rodar migrations em staging antes de produção
- **Sempre** testar fluxo de auth (signup, login, reset password) em cada ambiente

---

## CI/CD sugerido

```yaml
# .github/workflows/deploy.yml (exemplo conceitual)
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run typecheck

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run test

  build:
    needs: [lint, typecheck, test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run build

  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run build
      # Deploy steps (depende da plataforma de hosting)
```
