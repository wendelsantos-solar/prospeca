# Geolocalização na Entrada — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ao entrar, oferecer geolocalização do navegador para centralizar o mapa no usuário e marcar sua posição; ele então escolhe o que/onde pesquisar.

**Architecture:** Pré-prompt em card sobre o mapa (1ª entrada) + memória de última localização (localStorage). GPS → centraliza + marca (pin instantâneo, label assíncrono via reverse-geocode na Edge Function/Google), sem disparar busca. Novo estado "mapa preview" antes da 1ª busca.

**Tech Stack:** React + TypeScript, Zustand (persist), Leaflet, Supabase Edge Functions (Deno), Google Geocoding API, Tailwind + shadcn/ui, Sonner (toasts).

## Global Constraints

- Não alterar Sidebar, Navegação, Kanban, Dashboard, Design System, tokens, paleta, tipografia fora do necessário para esta feature.
- Reverse geocode via **Edge Function + Google** (server key), nunca chamada Google direta do browser (sem CORS).
- Geolocalização e centralização funcionam em demo e real; reverse-geocode via Google só em modo real (`isRealMode`). Em demo, label cai para "Minha localização".
- **Não** disparar busca automática ao obter localização — só centraliza + marca.
- Persistir apenas `{label, lat, lng}` da última localização (localStorage, `partialize`), nunca histórico de posições. Coords nunca em query string.
- Verificação do projeto (sem test runner): `npx tsc --noEmit` limpo, `npx eslint <arquivos>` limpo, validação no navegador. Convenção de commit já usada: `feat:` / `fix:`.

---

### Task 0: Branch de trabalho

**Files:** nenhum (git).

- [ ] **Step 1: Criar branch a partir da main**

Run:

```bash
cd /home/wendelsantos/works/leads
git checkout -b feat/geolocation-onboarding
```

Expected: `Switched to a new branch 'feat/geolocation-onboarding'`

---

### Task 1: Reverse geocode na Edge Function

**Files:**

- Modify: `supabase/functions/_shared/google.ts` (adicionar `reverseGeocode` + helper de label)
- Modify: `supabase/functions/geocode-location/index.ts` (aceitar modo reverse)

**Interfaces:**

- Produces: `reverseGeocode(lat: number, lng: number): Promise<{ label: string; latitude: number; longitude: number } | null>` em `_shared/google.ts`
- Produces: `geocode-location` passa a aceitar `{ latitude: number, longitude: number }` além de `{ query: string }`, retornando `{ label, latitude, longitude }`.

- [ ] **Step 1: Adicionar helper de label + reverseGeocode em google.ts**

Ao final de `supabase/functions/_shared/google.ts`, adicionar:

```ts
type AddressComponent = { long_name: string; short_name: string; types: string[] };

/** Monta "Bairro, Cidade" a partir dos address_components do Geocoding. */
export function buildReverseLabel(
  components: AddressComponent[],
  formattedAddress: string,
): string {
  const pick = (...types: string[]) =>
    components.find((c) => types.some((t) => c.types.includes(t)))?.long_name;

  const neighborhood = pick("sublocality_level_1", "sublocality", "neighborhood");
  const city = pick("administrative_area_level_2", "locality");
  const state = pick("administrative_area_level_1");

  if (neighborhood && city) return `${neighborhood}, ${city}`;
  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  return formattedAddress;
}

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<{ label: string; latitude: number; longitude: number } | null> {
  const url = new URL(GEOCODE_BASE);
  url.searchParams.set("latlng", `${lat},${lng}`);
  url.searchParams.set("region", "br");
  url.searchParams.set("language", "pt-BR");
  url.searchParams.set("key", serverKey());
  const res = await fetch(url);
  if (!res.ok) throw new AppError("PROVIDER_UNAVAILABLE", "Falha na geocodificação reversa.");
  const data = await res.json();
  const first = data.results?.[0];
  if (!first) return null;
  return {
    label: buildReverseLabel(first.address_components ?? [], first.formatted_address ?? ""),
    latitude: lat,
    longitude: lng,
  };
}
```

- [ ] **Step 2: Validar buildReverseLabel isoladamente (função pura)**

Run:

```bash
cd /home/wendelsantos/works/leads
node -e '
function buildReverseLabel(components, fa){
  const pick=(...t)=>components.find(c=>t.some(x=>c.types.includes(x)))?.long_name;
  const n=pick("sublocality_level_1","sublocality","neighborhood");
  const c=pick("administrative_area_level_2","locality");
  const s=pick("administrative_area_level_1");
  if(n&&c)return n+", "+c; if(c&&s)return c+", "+s; if(c)return c; return fa;
}
const comps=[
  {long_name:"Moinhos de Vento",short_name:"Moinhos de Vento",types:["sublocality_level_1","sublocality"]},
  {long_name:"Porto Alegre",short_name:"Porto Alegre",types:["administrative_area_level_2"]},
  {long_name:"Rio Grande do Sul",short_name:"RS",types:["administrative_area_level_1"]},
];
console.log(buildReverseLabel(comps,"fallback"));
'
```

Expected: `Moinhos de Vento, Porto Alegre`

- [ ] **Step 3: Aceitar modo reverse em geocode-location/index.ts**

Substituir o import e o `InputSchema` no topo de `supabase/functions/geocode-location/index.ts`:

```ts
import { geocode, reverseGeocode } from "../_shared/google.ts";

const InputSchema = z.union([
  z.object({ query: z.string().min(2).max(200) }),
  z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
]);
```

Logo após `await assertRateLimit(...)`, adicionar o ramo reverse (antes da lógica de cache/forward existente):

```ts
if ("latitude" in parsed.data) {
  const geo = await reverseGeocode(parsed.data.latitude, parsed.data.longitude);
  if (!geo) throw new AppError("INVALID_LOCATION", "Localização não encontrada.");
  await recordUsage(ctx.adminClient, {
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    eventType: "geocode_request",
    provider: "google_geocoding",
  });
  logEvent({ requestId, operation: "geocode-location", status: "ok" });
  return json({ ...geo, cached: false });
}
```

O restante (bloco forward com `parsed.data.query`) permanece; trocar as referências de `parsed.data.query` que ficaram no forward para continuar válidas (o union garante `query` só nesse ramo — usar `parsed.data.query` dentro dele).

- [ ] **Step 4: Type-check das funções (Deno via tsc do projeto não cobre; conferir sintaxe com deno check se disponível, senão pular)**

Run:

```bash
cd /home/wendelsantos/works/leads
deno --version >/dev/null 2>&1 && deno check supabase/functions/geocode-location/index.ts 2>&1 | tail -5 || echo "(deno indisponível — validação via deploy no passo seguinte)"
```

Expected: sem erros, ou a mensagem de deno indisponível.

- [ ] **Step 5: Deploy da função**

Run:

```bash
cd /home/wendelsantos/works/leads
npx supabase functions deploy geocode-location 2>&1 | tail -5
```

Expected: `Deployed Functions.`

- [ ] **Step 6: Smoke test do reverse via Google (valida a lógica com a server key real)**

Run:

```bash
cd /home/wendelsantos/works/leads
KEY=$(grep '^GOOGLE_MAPS_SERVER_KEY=' .env.local | cut -d= -f2)
curl -s "https://maps.googleapis.com/maps/api/geocode/json?latlng=-30.0234,-51.2010&region=br&language=pt-BR&key=$KEY" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print('status',d['status']);print('addr',d['results'][0]['formatted_address'] if d['results'] else 'sem resultado')"
```

Expected: `status OK` e um endereço em Porto Alegre.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/_shared/google.ts supabase/functions/geocode-location/index.ts
git commit -m "feat: reverse geocode mode in geocode-location function"
```

---

### Task 2: Lib cliente de reverse geocode

**Files:**

- Create: `src/lib/reverse-geocode.ts`

**Interfaces:**

- Consumes: `invokeFunction` de `@/lib/supabase`, `isRealMode` de `@/lib/env`
- Produces: `reverseGeocodeCoords(lat: number, lng: number): Promise<string | null>` — retorna o label ou `null` (demo/erro).

- [ ] **Step 1: Criar src/lib/reverse-geocode.ts**

```ts
import { invokeFunction } from "@/lib/supabase";
import { isRealMode } from "@/lib/env";

/**
 * Converte coordenadas em um label "Bairro, Cidade" via Edge Function (Google).
 * Retorna null em modo demo ou se a resolução falhar — o chamador decide o fallback.
 */
export async function reverseGeocodeCoords(lat: number, lng: number): Promise<string | null> {
  if (!isRealMode) return null;
  try {
    const res = await invokeFunction<{ label: string }>("geocode-location", {
      latitude: lat,
      longitude: lng,
    });
    return res.label ?? null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Type-check**

Run: `cd /home/wendelsantos/works/leads && npx tsc --noEmit 2>&1 | tail -5`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/reverse-geocode.ts
git commit -m "feat: client reverse-geocode helper"
```

---

### Task 3: Hook useGeolocation

**Files:**

- Create: `src/hooks/useGeolocation.ts`

**Interfaces:**

- Produces: `useGeolocation(): { status: GeoStatus; request: () => void; supported: boolean }` onde `GeoStatus = "idle" | "prompting" | "granted" | "denied" | "error"`, e um callback de sucesso via parâmetro.
- Produces exact signature:
  `useGeolocation(onSuccess: (coords: { lat: number; lng: number }) => void): { status: GeoStatus; request: () => void; supported: boolean }`

- [ ] **Step 1: Criar src/hooks/useGeolocation.ts**

```ts
import { useCallback, useState } from "react";

export type GeoStatus = "idle" | "prompting" | "granted" | "denied" | "error";

const supported = typeof navigator !== "undefined" && "geolocation" in navigator;

export function useGeolocation(onSuccess: (coords: { lat: number; lng: number }) => void) {
  const [status, setStatus] = useState<GeoStatus>("idle");

  const request = useCallback(() => {
    if (!supported) {
      setStatus("error");
      return;
    }
    setStatus("prompting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStatus("granted");
        onSuccess({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "error");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }, [onSuccess]);

  return { status, request, supported };
}
```

- [ ] **Step 2: Type-check**

Run: `cd /home/wendelsantos/works/leads && npx tsc --noEmit 2>&1 | tail -5`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useGeolocation.ts
git commit -m "feat: useGeolocation hook"
```

---

### Task 4: Store de memória da última localização

**Files:**

- Modify: `src/stores/index.ts` (novo store persistido `useLocationStore`)

**Interfaces:**

- Produces: `useLocationStore` com `{ lastLocation: { label: string; lat: number; lng: number } | null; setLastLocation: (l: { label: string; lat: number; lng: number }) => void }`

- [ ] **Step 1: Adicionar o store ao final de src/stores/index.ts**

```ts
// ---- Última localização escolhida (memória de onboarding) ----
export interface SavedLocation {
  label: string;
  lat: number;
  lng: number;
}
interface LocationState {
  lastLocation: SavedLocation | null;
  setLastLocation: (l: SavedLocation) => void;
}
export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      lastLocation: null,
      setLastLocation: (lastLocation) => set({ lastLocation }),
    }),
    { name: `${STORAGE_KEY}:location`, storage: createJSONStorage(() => safeStorage()) },
  ),
);
```

- [ ] **Step 2: Type-check**

Run: `cd /home/wendelsantos/works/leads && npx tsc --noEmit 2>&1 | tail -5`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/stores/index.ts
git commit -m "feat: persisted last-location store"
```

---

### Task 5: previewLocation transiente no leads store

**Files:**

- Modify: `src/stores/index.ts` (interface `LeadsState`, estado inicial, action; NÃO adicionar ao `partialize`)

**Interfaces:**

- Produces: no `useLeadsStore`: `previewLocation: { lat: number; lng: number; radiusKm: number; label: string } | null` e `setPreviewLocation: (p: LeadsState["previewLocation"]) => void`.

- [ ] **Step 1: Declarar no tipo LeadsState**

Em `src/stores/index.ts`, dentro de `interface LeadsState`, após `currentSearch: Search | null;` adicionar:

```ts
  previewLocation: { lat: number; lng: number; radiusKm: number; label: string } | null;
```

E na lista de actions (após `setLeads`):

```ts
  setPreviewLocation: (p: LeadsState["previewLocation"]) => void;
```

- [ ] **Step 2: Estado inicial + action**

No objeto do `create`, após `currentSearch: null,` adicionar:

```ts
      previewLocation: null,
```

E junto às actions (após `setLeads`):

```ts
      setPreviewLocation: (previewLocation) => set({ previewLocation }),
```

No `setLeads`, limpar o preview ao concretizar a busca — dentro do `set((s) => ({ ... }))` do setLeads, adicionar `previewLocation: null,`.

- [ ] **Step 3: Type-check (garantir que previewLocation NÃO entrou no partialize)**

Run: `cd /home/wendelsantos/works/leads && npx tsc --noEmit 2>&1 | tail -5`
Expected: sem erros. (Confirmar visualmente que `partialize` em ~linha 354 não lista `previewLocation`.)

- [ ] **Step 4: Commit**

```bash
git add src/stores/index.ts
git commit -m "feat: transient previewLocation in leads store"
```

---

### Task 6: MapView desenha pin + círculo do previewLocation

**Files:**

- Modify: `src/components/app/MapView.tsx`

**Interfaces:**

- Consumes: `useLeadsStore(s => s.previewLocation)`
- Produces: quando não há `currentSearch` mas há `previewLocation`, o mapa centraliza nele e desenha o marcador central + círculo do raio (reaproveitando `centerRef`/`circleRef`).

- [ ] **Step 1: Ler previewLocation e centralizar/desenhar quando não há currentSearch**

Em `src/components/app/MapView.tsx`, após `const currentSearch = useLeadsStore((s) => s.currentSearch);` adicionar:

```ts
const previewLocation = useLeadsStore((s) => s.previewLocation);
```

Adicionar um `useEffect` novo (após o effect que trata `currentSearch, showCircle`):

```ts
useEffect(() => {
  const map = mapRef.current;
  if (!map || currentSearch || !previewLocation) return;
  const { lat, lng, radiusKm } = previewLocation;
  map.setView([lat, lng], 13);
  if (circleRef.current) {
    map.removeLayer(circleRef.current);
    circleRef.current = null;
  }
  if (showCircle) {
    circleRef.current = L.circle([lat, lng], {
      radius: radiusKm * 1000,
      color: "oklch(0.58 0.14 155)",
      fillColor: "oklch(0.58 0.14 155)",
      fillOpacity: 0.06,
      weight: 1.5,
    }).addTo(map);
  }
  if (centerRef.current) map.removeLayer(centerRef.current);
  centerRef.current = L.marker([lat, lng], {
    icon: L.divIcon({
      html: '<div style="width:12px;height:12px;border-radius:50%;background:oklch(0.58 0.14 155);border:2px solid white;box-shadow:0 0 0 3px oklch(0.58 0.14 155 / 0.25);"></div>',
      className: "",
      iconSize: [12, 12],
    }),
  }).addTo(map);
}, [previewLocation, currentSearch, showCircle]);
```

- [ ] **Step 2: Type-check**

Run: `cd /home/wendelsantos/works/leads && npx tsc --noEmit 2>&1 | tail -5`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/app/MapView.tsx
git commit -m "feat: MapView renders preview pin and radius circle"
```

---

### Task 7: Estado "mapa preview" na rota app.mapa

**Files:**

- Modify: `src/routes/app.mapa.tsx`

**Interfaces:**

- Consumes: `useLeadsStore(s => s.previewLocation)`
- Produces: quando `!loaded` e existe `previewLocation`, renderiza `<MapView leads={[]} />` (preview) em vez do `HomeState`.

- [ ] **Step 1: Renderizar MapView em preview quando há previewLocation**

Em `src/routes/app.mapa.tsx`, dentro de `MapaPage`, ler o preview:

```ts
const previewLocation = useLeadsStore((s) => s.previewLocation);
```

Alterar o ramo do HomeState (`if (!loaded && allLeads.length === 0) { return <HomeState />; }`) para:

```ts
  if (!loaded && allLeads.length === 0) {
    if (previewLocation) {
      return (
        <Suspense fallback={<CenteredLoader label="Carregando o mapa..." />}>
          <MapView leads={[]} />
        </Suspense>
      );
    }
    return <HomeState />;
  }
```

- [ ] **Step 2: Type-check**

Run: `cd /home/wendelsantos/works/leads && npx tsc --noEmit 2>&1 | tail -5`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/routes/app.mapa.tsx
git commit -m "feat: map preview state before first search"
```

---

### Task 8: LocationPrompt (card sobre o mapa)

**Files:**

- Create: `src/components/app/LocationPrompt.tsx`

**Interfaces:**

- Consumes: `useGeolocation`, `useLeadsStore.setPreviewLocation`, `useLocationStore.setLastLocation`, `reverseGeocodeCoords`, `useSettingsStore.defaultRadius`
- Produces: `<LocationPrompt onDismiss={() => void} onPickCity={() => void} />` — card overlay com "Usar minha localização" e "Escolher cidade".

- [ ] **Step 1: Criar src/components/app/LocationPrompt.tsx**

```tsx
import { MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useLeadsStore, useLocationStore, useSettingsStore } from "@/stores";
import { reverseGeocodeCoords } from "@/lib/reverse-geocode";
import { toast } from "sonner";

interface LocationPromptProps {
  onDismiss: () => void;
  onPickCity: () => void;
}

export function LocationPrompt({ onDismiss, onPickCity }: LocationPromptProps) {
  const setPreviewLocation = useLeadsStore((s) => s.setPreviewLocation);
  const setLastLocation = useLocationStore((s) => s.setLastLocation);
  const defaultRadius = useSettingsStore((s) => s.defaultRadius);

  const { status, request, supported } = useGeolocation((coords) => {
    const label = "Localizando...";
    setPreviewLocation({ lat: coords.lat, lng: coords.lng, radiusKm: defaultRadius, label });
    onDismiss();
    // Label assíncrono — não bloqueia o pin.
    reverseGeocodeCoords(coords.lat, coords.lng).then((resolved) => {
      const finalLabel = resolved ?? "Minha localização";
      setPreviewLocation({
        lat: coords.lat,
        lng: coords.lng,
        radiusKm: defaultRadius,
        label: finalLabel,
      });
      setLastLocation({ label: finalLabel, lat: coords.lat, lng: coords.lng });
      window.dispatchEvent(
        new CustomEvent("geo-located", {
          detail: { label: finalLabel, lat: coords.lat, lng: coords.lng },
        }),
      );
    });
  });

  if (status === "denied" || status === "error") {
    toast.error("Sem acesso à localização — escolha uma cidade.");
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-[500] grid place-items-center p-4">
      <div className="pointer-events-auto w-full max-w-sm rounded-xl border bg-surface/95 p-5 text-center shadow-elevated backdrop-blur">
        <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
          <MapPin className="h-5 w-5" />
        </div>
        <h2 className="text-base font-semibold">Ver empresas perto de você?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Usamos sua localização apenas para centralizar o mapa e sugerir oportunidades próximas.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {supported && (
            <Button onClick={request} disabled={status === "prompting"} className="gap-2">
              {status === "prompting" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MapPin className="h-4 w-4" />
              )}
              Usar minha localização
            </Button>
          )}
          <Button variant="outline" onClick={onPickCity}>
            Escolher cidade
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd /home/wendelsantos/works/leads && npx tsc --noEmit 2>&1 | tail -5`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/app/LocationPrompt.tsx
git commit -m "feat: LocationPrompt card component"
```

---

### Task 9: Mostrar o card na 1ª entrada (HomeState) e integrar retornante

**Files:**

- Modify: `src/routes/app.mapa.tsx`

**Interfaces:**

- Consumes: `useLocationStore.lastLocation`, `useLeadsStore.setPreviewLocation`, `LocationPrompt`, `useSettingsStore.defaultRadius`

- [ ] **Step 1: Ao montar, hidratar previewLocation da memória; senão marcar para mostrar o card**

Em `src/routes/app.mapa.tsx`, dentro de `MapaPage`, adicionar:

```ts
const lastLocation = useLocationStore((s) => s.lastLocation);
const setPreviewLocation = useLeadsStore((s) => s.setPreviewLocation);
const defaultRadius = useSettingsStore((s) => s.defaultRadius);
const [promptDismissed, setPromptDismissed] = useState(false);

useEffect(() => {
  const s = useLeadsStore.getState();
  if (s.loaded || s.previewLocation) return;
  if (lastLocation) {
    setPreviewLocation({
      lat: lastLocation.lat,
      lng: lastLocation.lng,
      radiusKm: defaultRadius,
      label: lastLocation.label,
    });
  }
}, [lastLocation, setPreviewLocation, defaultRadius]);
```

(adicionar os imports: `useEffect, useState` de react, `useLocationStore, useSettingsStore` de `@/stores`, `LocationPrompt` de `@/components/app/LocationPrompt`.)

- [ ] **Step 2: Renderizar o card sobre o mapa preview quando não há memória**

Substituir o ramo `if (!loaded && allLeads.length === 0)` (ajustado na Task 7) por:

```ts
  if (!loaded && allLeads.length === 0) {
    const showPrompt = !lastLocation && !previewLocation && !promptDismissed;
    if (previewLocation || showPrompt) {
      return (
        <div className="relative h-full w-full">
          <Suspense fallback={<CenteredLoader label="Carregando o mapa..." />}>
            <MapView leads={[]} />
          </Suspense>
          {showPrompt && (
            <LocationPrompt
              onDismiss={() => setPromptDismissed(true)}
              onPickCity={() => {
                setPromptDismissed(true);
                window.dispatchEvent(new CustomEvent("focus-niche"));
              }}
            />
          )}
        </div>
      );
    }
    return <HomeState />;
  }
```

- [ ] **Step 3: Type-check**

Run: `cd /home/wendelsantos/works/leads && npx tsc --noEmit 2>&1 | tail -5`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/routes/app.mapa.tsx
git commit -m "feat: show location prompt on first entry, hydrate from memory"
```

---

### Task 10: Wire no SearchForm (botão GPS + remover auto-search + sincronizar label)

**Files:**

- Modify: `src/components/app/SearchForm.tsx`

**Interfaces:**

- Consumes: `useGeolocation`, `reverseGeocodeCoords`, `useLeadsStore.setPreviewLocation`, `useLocationStore`, evento `geo-located`

- [ ] **Step 1: Remover o auto-search de mount e escutar geo-located**

Em `src/components/app/SearchForm.tsx`, no `useEffect` de mount, **remover** a linha `if (!s.loaded) runSearch();`. Adicionar um listener que sincroniza os campos quando o card/GPS resolve:

```ts
const onGeoLocated = (e: Event) => {
  const d = (e as CustomEvent<{ label: string; lat: number; lng: number }>).detail;
  setLocation(d.label);
  setLocCoords({ lat: d.lat, lng: d.lng });
};
window.addEventListener("geo-located", onGeoLocated);
```

e no cleanup: `window.removeEventListener("geo-located", onGeoLocated);`

- [ ] **Step 2: Hidratar os campos da memória no mount (retornante)**

Ainda no `useEffect` de mount, no início:

```ts
const last = useLocationStore.getState().lastLocation;
if (last) {
  setLocation(last.label);
  setLocCoords({ lat: last.lat, lng: last.lng });
}
```

(import `useLocationStore` de `@/stores`.)

- [ ] **Step 3: Botão GPS compacto no campo Localização**

Logo abaixo do `<Popover>` de Localização (dentro do mesmo `div.space-y-1.5`), adicionar:

```tsx
<GpsButton
  radiusKm={radius}
  onLocated={(label, lat, lng) => {
    setLocation(label);
    setLocCoords({ lat, lng });
  }}
/>
```

E criar o subcomponente no mesmo arquivo (acima de `export function SearchForm`):

```tsx
function GpsButton({
  radiusKm,
  onLocated,
}: {
  radiusKm: number;
  onLocated: (label: string, lat: number, lng: number) => void;
}) {
  const setPreviewLocation = useLeadsStore((s) => s.setPreviewLocation);
  const setLastLocation = useLocationStore((s) => s.setLastLocation);
  const { status, request, supported } = useGeolocation((coords) => {
    setPreviewLocation({ lat: coords.lat, lng: coords.lng, radiusKm, label: "Localizando..." });
    onLocated("Localizando...", coords.lat, coords.lng);
    reverseGeocodeCoords(coords.lat, coords.lng).then((resolved) => {
      const label = resolved ?? "Minha localização";
      setPreviewLocation({ lat: coords.lat, lng: coords.lng, radiusKm, label });
      setLastLocation({ label, lat: coords.lat, lng: coords.lng });
      onLocated(label, coords.lat, coords.lng);
    });
    if (status === "denied") toast.error("Sem acesso à localização.");
  });
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={request}
      className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-primary hover:underline"
    >
      {status === "prompting" ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <MapPin className="h-3 w-3" />
      )}
      Usar minha localização
    </button>
  );
}
```

(imports adicionais no topo: `useLeadsStore` já existe; adicionar `useLocationStore`; `useGeolocation` de `@/hooks/useGeolocation`; `reverseGeocodeCoords` de `@/lib/reverse-geocode`; `MapPin, Loader2` já importados.)

- [ ] **Step 4: Type-check + lint**

Run:

```bash
cd /home/wendelsantos/works/leads
npx tsc --noEmit 2>&1 | tail -5
npx eslint src/components/app/SearchForm.tsx src/components/app/LocationPrompt.tsx src/hooks/useGeolocation.ts src/lib/reverse-geocode.ts 2>&1 | tail -15
```

Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/components/app/SearchForm.tsx
git commit -m "feat: GPS button in search form, remove auto-search on mount"
```

---

### Task 11: Verificação end-to-end no navegador

**Files:** nenhum (validação).

- [ ] **Step 1: Subir o dev e abrir o mapa**

Usar `preview_start {name: "dev"}` e navegar para `http://localhost:8081/app/mapa` (porta real do Vite). Limpar localStorage antes (`localStorage.clear()`) para simular 1ª entrada.

- [ ] **Step 2: Mockar geolocation e validar o card + pin**

No DevTools/JS: sobrescrever `navigator.geolocation.getCurrentPosition` para retornar coords de Porto Alegre (`-30.0234, -51.2010`), clicar "Usar minha localização", confirmar:

- card some
- pin + círculo aparecem no mapa (checar `previewLocation` no store e marcador Leaflet)
- label do campo Localização vira "Localizando..." e depois "Bairro, Cidade"
- **não** houve busca automática (nenhum lead, sem toast de "empresas encontradas")

- [ ] **Step 3: Validar memória (retornante)**

Recarregar a página (sem limpar localStorage). Confirmar: sem card, mapa já centralizado na última localização, campo preenchido.

- [ ] **Step 4: Validar negação**

Limpar localStorage, mockar `getCurrentPosition` chamando o error callback com `code: 1` (PERMISSION_DENIED). Clicar "Usar minha localização". Confirmar toast "Sem acesso à localização — escolha uma cidade" e que "Escolher cidade" continua funcional.

- [ ] **Step 5: Console limpo**

`read_console_messages onlyErrors:true` → sem erros. Parar o dev server.

- [ ] **Step 6: Commit final (se algum ajuste)**

```bash
git add -A
git commit -m "chore: verify geolocation onboarding flow"
```

---

## Self-Review (resultado)

**Cobertura do spec:**

- Pré-prompt card sobre o mapa → Task 8, 9 ✓
- Memória + retornante → Task 4, 9, 10 ✓
- GPS centraliza + marca, sem buscar → Task 6, 7, 10 (auto-search removido) ✓
- Pin instantâneo, label assíncrono → Task 8 e 10 (setPreviewLocation com "Localizando..." antes do reverse) ✓
- Reverse via Edge/Google → Task 1, 2 ✓
- Estado mapa preview → Task 6, 7 ✓
- Botão GPS secundário → Task 10 ✓
- Fallbacks (negado/sem suporte/erro) → Task 8, 10, 11 ✓
- Modo demo (label "Minha localização") → Task 2 (retorna null) + Task 8/10 (fallback) ✓
- LGPD/persistência mínima → Task 4 (só label+coords), partialize sem previewLocation (Task 5) ✓

**Placeholders:** nenhum — todo passo tem código/comando reais.

**Consistência de tipos:** `setPreviewLocation` shape `{lat,lng,radiusKm,label}` idêntico em Tasks 5/6/7/8/10; `SavedLocation {label,lat,lng}` idêntico em Tasks 4/8/10; `reverseGeocodeCoords(lat,lng)→Promise<string|null>` consistente; `useGeolocation(onSuccess)` idêntico em Tasks 3/8/10.
