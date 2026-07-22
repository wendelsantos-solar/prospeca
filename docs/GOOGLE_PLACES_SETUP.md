# Configuração Google Places / Maps

> **Google é opcional.** Com as flags `USE_OSM_GEOCODER`/`USE_OSM_PLACES`/`USE_OSM_MAP_PROVIDER=true`
> a plataforma roda 100% no OpenStreetMap (geocoding, descoberta, detalhes e tiles).
> Ver `docs/local-development.md` → "Rodar sem Google (OSM-only)". Este guia serve
> só se você optar por usar o Google como provider.

## 1. Projeto Google Cloud

1. Crie um projeto em console.cloud.google.com.
2. Ative billing (obrigatório para Places API New).
3. Ative as APIs:
   - **Places API (New)** — buscas e detalhes (server).
   - **Geocoding API** — resolução de localização (server).
   - **Maps JavaScript API** — renderização do mapa (browser).

## 2. Chaves (duas, com restrições distintas)

### Chave de servidor (`GOOGLE_MAPS_SERVER_KEY`)

- Restrição de API: apenas Places API (New) + Geocoding API.
- Sem restrição de referrer (usada por Edge Functions).
- Configurar como secret do Supabase:

```bash
supabase secrets set GOOGLE_MAPS_SERVER_KEY=<chave>
```

### Chave de navegador (`VITE_GOOGLE_MAPS_BROWSER_KEY`)

- Restrição de API: apenas Maps JavaScript API.
- Restrição de aplicação: HTTP referrers com os domínios do app
  (ex.: `https://app.seudominio.com/*`, `http://localhost:*` em dev).
- Vai no `.env` do frontend (é pública por natureza, a restrição por domínio
  é a proteção).

## 3. FieldMask e custos

As Edge Functions usam FieldMask mínimo (id, displayName, formattedAddress,
location, types, businessStatus, rating, userRatingCount, websiteUri,
telefones, googleMapsUri). **Não** solicitam fotos, reviews ou horários na
busca — apenas `refresh-place-details` busca horários quando explicitamente
solicitado. Valide os SKUs atuais na tabela de preços do Google antes de
alterar o FieldMask.

## 4. Políticas obrigatórias

- Dados do Places são exibidos sobre Google Maps (nunca OpenStreetMap).
- Atribuições do Google preservadas no mapa.
- Cache limitado: `provider_refresh_after` (30 dias) força atualização;
  não armazene indefinidamente além do permitido pela licença.
- Proibido: scraping do Google Maps, APIs não documentadas, contorno de
  CAPTCHA, automação de navegador para extração.
