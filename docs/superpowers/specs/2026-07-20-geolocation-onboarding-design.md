# Geolocalização na entrada — Design

## Objetivo

Ao entrar na plataforma, oferecer (sem impor) que o usuário use a localização do
navegador para centralizar o mapa nele e marcar sua posição. A partir daí o
usuário escolhe o que e onde pesquisar. Melhora o primeiro contato com contexto
imediato, sem cair no anti-padrão de pedir permissão de geolocalização no load
frio.

## Princípios de UX

- **Nunca pedir permissão no load frio.** Pedir em contexto, após um pré-prompt
  que explica o porquê → taxa de aceite muito maior.
- **Pin instantâneo, label assíncrono.** Ao obter coords do GPS, o mapa centraliza
  e mostra o pin imediatamente; o reverse-geocode roda em paralelo e preenche o
  texto do local em seguida (`Localizando...` → `Bairro, Cidade`).
- **Usuário no controle.** Obter a localização apenas centraliza + marca; **não**
  dispara busca. Ele ajusta nicho/raio/local e clica "Buscar empresas".
- **Memória.** Retornante entra direto na última localização usada.

## Fluxo

### Primeira entrada (sem localização salva)

1. Mapa aparece numa visão ampla (região/Brasil) como fundo.
2. Card discreto sobre o mapa: **"📍 Ver empresas perto de você?"** com dois botões:
   - **Usar minha localização** → dispara `navigator.geolocation`.
   - **Escolher cidade** → dispensa o card e abre/foca o seletor de Localização.
3. Se conceder GPS: pin + círculo do raio aparecem na hora; label resolve async;
   card some. Sem busca automática.
4. Se negar/erro: toast "Sem acesso à localização — escolha uma cidade"; card vira
   só o caminho "Escolher cidade".

### Entrada de retornante (com localização salva)

- Pula o card. Mapa já centraliza na última localização (`previewLocation`) com pin
  + círculo. Sem busca automática.

### Entrada alternativa (a qualquer momento)

- Botão compacto **📍 Usar minha localização** dentro do campo "Localização", com o
  mesmo comportamento do item 3.

## Componentes

| Unidade | Responsabilidade | Depende de |
|---|---|---|
| `useGeolocation` (hook) | Envolve `navigator.geolocation.getCurrentPosition`; expõe estado `idle/prompting/granted/denied/unsupported/error` + `{lat,lng}` | Web API |
| `reverseGeocode(lat,lng)` (lib) | Coords → label "Bairro, Cidade" via Edge Function | `geocode-location` |
| Edge Function `geocode-location` (estender) | Aceitar `{lat,lng}` e retornar endereço via reverse geocode (Google server key) | `_shared/google.ts` |
| `_shared/google.ts` `reverseGeocode()` | Chamada ao Geocoding API com `latlng=` | server key |
| Location memory (store slice persistido) | Guardar/ler `{label,lat,lng}` da última localização | localStorage |
| `previewLocation` (leads store) | Centro pendente `{lat,lng,radiusKm,label}` antes de buscar | — |
| `LocationPrompt` (card sobre o mapa) | Pré-prompt de 1ª entrada | `useGeolocation` |
| `MapView` (ajuste) | Renderizar pin + círculo do `previewLocation` quando não há busca ainda | Leaflet |
| `app.mapa` (ajuste de roteamento de estado) | Mostrar MapView em "preview" quando há `previewLocation` e ainda não buscou | store |
| `SearchForm` (wire) | Botão GPS secundário; ao obter local, setar label+coords+previewLocation, centralizar, sem buscar | hook, store |

## Reverse geocoding — decisão

**Edge Function + Google** (não Nominatim). Motivos: precisão de bairro no Brasil,
robustez de produção (sem limite de 1 req/s / política de uso), reuso do server key
+ Geocoding já configurados. A latência é escondida pelo padrão pin-instantâneo /
label-assíncrono.

A `geocode-location` passa a aceitar dois modos:

- Forward (atual): `{ query: string }` → `{ label, latitude, longitude }`
- Reverse (novo): `{ latitude, longitude }` → `{ label, latitude, longitude }`

`_shared/google.ts` ganha `reverseGeocode(lat, lng)` que chama o Geocoding API com
`latlng=lat,lng&language=pt-BR&region=br` e monta o label a partir dos
`address_components` (bairro + cidade, com fallback pro `formatted_address`).

## Fluxo de dados

```
Card / botão GPS
  → useGeolocation.request()
    → getCurrentPosition
      → sucesso: { lat, lng }
        → setPreviewLocation({ lat, lng, radiusKm, label: "Localizando..." })  (pin instantâneo)
        → setLocationMemory({ lat, lng })
        → reverseGeocode(lat, lng)  (async)
            → atualiza label no campo + previewLocation + memory
      → erro/negado: toast + mantém "Escolher cidade"
```

## Estados

- **Loading**: pin já visível; label "Localizando..." enquanto o reverse resolve.
- **Empty**: primeira entrada sem memória → card de pré-prompt.
- **Success**: pin + círculo + label resolvido; usuário busca quando quiser.
- **Error/Denied**: toast amigável; degrada pro seletor de cidade; botão GPS some
  se `unsupported`.

## Modo demo

Geolocalização e centralização funcionam nos dois modos (é API de navegador). O
reverse-geocode via Google só roda em modo real; em demo, o label cai pra
"Minha localização" ou a cidade mais próxima das sugestões estáticas. O mapa
centraliza normalmente pelas coords.

## Privacidade / LGPD

- O pré-prompt explica o propósito antes de pedir permissão.
- Persistimos apenas a **cidade/label + coords escolhidas** (localStorage, local ao
  dispositivo), não um histórico de posições. Coords não vão em query string.
- Compatível com `docs/LGPD.md` (dado de localização usado só para a função pedida).

## Não faz parte (YAGNI)

- "Buscar aqui" ao arrastar o mapa, pin arrastável, fallback por IP — ideias boas,
  ficam para iterações futuras. Este spec entrega o núcleo: pré-prompt → GPS →
  centralizar + marcar → usuário busca.

## Teste

- `navigator.geolocation` é API de navegador → validação via DevTools (mock de
  coordenadas) e fluxo manual real. Sem unit test da API nativa.
- `reverseGeocode` da Edge Function: testável via curl direto na função com
  `{lat,lng}` conhecidos (ex.: Porto Alegre) conferindo o label retornado.
- Decoder/parse de `address_components`: função pura, testável isolada.
