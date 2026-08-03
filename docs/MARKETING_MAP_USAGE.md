# Marketing Map Usage

Documenta a abordagem do Prospeca para demonstrar o mapa na landing page.

## Abordagem escolhida

**Opção C — Composição CSS estilizada** (com fallback para screenshot futuro)

A demonstração do mapa na landing (`MapSection` e `HeroProductDemo`) usa uma composição
visual construída com CSS que representa:

- Grid pattern (simula textura de ruas)
- Linhas horizontais/verticais (simula vias principais)
- Círculo de raio (área de busca)
- Marcadores coloridos com scores
- Barra de busca e tooltip de lead

Esta abordagem foi escolhida porque:

1. **Não carrega Google Maps JS** — zero impacto na performance da landing
2. **Não requer chave de API no frontend público** — evita exposição de credenciais
3. **Funciona offline / SSR** — sem dependência de API externa para a primeira renderização
4. **Visualmente informativa** — demonstra o conceito de busca geográfica sem precisar de tiles reais

## Abordagens alternativas (futuro)

### Opção A — Google Maps real em modo demo

- Renderizar `<GoogleMapView>` com dados demo e chave restrita
- Vantagem: demonstração 100% fiel ao produto
- Desvantagem: carrega ~200KB de JS, impacto no LCP

### Opção B — Maps Static API

- Usar imagem estática do Google Maps com marcadores
- Vantagem: leve, sem JS
- Desvantagem: requer chave de API, custo por requisição, sem interatividade

## Atribuição

Ao usar Google Maps (futuro), manter:

- Logo do Google no mapa
- Termos de uso visíveis
- Atribuição "Dados do mapa © Google"

## Dados usados

Todos os dados de demonstração (`src/marketing/demo-data/index.ts`) são:

- **Fictícios** — empresas, endereços, nomes e telefones inventados
- **Marcados como demo** — isolados da produção
- **Sem dados pessoais reais** — nenhum cliente real, nenhum telefone verdadeiro

## Chave de API

- **Não exposta** na landing page atual (mapa é CSS-only)
- Futura chave para Google Maps: restrita por domínio HTTP referrer
- Armazenada em `VITE_GOOGLE_MAPS_BROWSER_KEY` (como a chave do app autenticado)

## Custo estimado

- Atual: **zero** (sem API calls)
- Com Maps Static API: ~$0.002 por carregamento de página (Static Maps)
- Com Maps JS API: $0.007 por carregamento (Dynamic Maps, 1-2 QPS)

## Fallback

Se o mapa não carregar (futuro com Google Maps):

1. Mostrar placeholder estático com grid CSS
2. Botão "Carregar mapa" para lazy-load
3. Loader enquanto carrega

## Atualização

Para atualizar a demonstração do mapa:

1. Modificar `src/marketing/demo-data/index.ts` para alterar dados
2. Atualizar `MapSection.tsx` ou `HeroProductDemo.tsx` para mudar a composição
3. Se migrar para Google Maps real: criar `MarketingMapPreview.tsx` e alternar via feature flag
