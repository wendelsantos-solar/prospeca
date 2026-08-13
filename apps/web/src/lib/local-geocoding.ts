// Local geocoding — offline fallback so region search works in demo mode AND
// degrades gracefully when the Google Geocoding edge function is unreachable.
// Coordinates are approximate city-centre values (sufficient for prospecting
// radii of 1–100 km), sourced from public data (IBGE/OSM).

export interface LocalCity {
  name: string;
  state: string; // UF
  stateName: string; // full name
  lat: number;
  lng: number;
}

/** State capitals + major metros (~55). Covers the vast majority of Brazilian
 * searches; the real geocoder still handles streets/neighbourhoods when online. */
export const LOCAL_CITIES: LocalCity[] = [
  // Capitals
  { name: "São Paulo", state: "SP", stateName: "São Paulo", lat: -23.5505, lng: -46.6333 },
  {
    name: "Rio de Janeiro",
    state: "RJ",
    stateName: "Rio de Janeiro",
    lat: -22.9068,
    lng: -43.1729,
  },
  { name: "Brasília", state: "DF", stateName: "Distrito Federal", lat: -15.7801, lng: -47.9292 },
  { name: "Salvador", state: "BA", stateName: "Bahia", lat: -12.9714, lng: -38.5014 },
  { name: "Fortaleza", state: "CE", stateName: "Ceará", lat: -3.7172, lng: -38.5433 },
  { name: "Belo Horizonte", state: "MG", stateName: "Minas Gerais", lat: -19.9167, lng: -43.9345 },
  { name: "Manaus", state: "AM", stateName: "Amazonas", lat: -3.119, lng: -60.0217 },
  { name: "Curitiba", state: "PR", stateName: "Paraná", lat: -25.4284, lng: -49.2733 },
  { name: "Recife", state: "PE", stateName: "Pernambuco", lat: -8.0476, lng: -34.877 },
  {
    name: "Porto Alegre",
    state: "RS",
    stateName: "Rio Grande do Sul",
    lat: -30.0346,
    lng: -51.2177,
  },
  { name: "Belém", state: "PA", stateName: "Pará", lat: -1.4558, lng: -48.4902 },
  { name: "Goiânia", state: "GO", stateName: "Goiás", lat: -16.6869, lng: -49.2648 },
  { name: "São Luís", state: "MA", stateName: "Maranhão", lat: -2.5387, lng: -44.2825 },
  { name: "Maceió", state: "AL", stateName: "Alagoas", lat: -9.6658, lng: -35.7353 },
  {
    name: "Campo Grande",
    state: "MS",
    stateName: "Mato Grosso do Sul",
    lat: -20.4697,
    lng: -54.6201,
  },
  { name: "Natal", state: "RN", stateName: "Rio Grande do Norte", lat: -5.7945, lng: -35.211 },
  { name: "Teresina", state: "PI", stateName: "Piauí", lat: -5.0892, lng: -42.8019 },
  { name: "João Pessoa", state: "PB", stateName: "Paraíba", lat: -7.1195, lng: -34.845 },
  { name: "Aracaju", state: "SE", stateName: "Sergipe", lat: -10.9472, lng: -37.0731 },
  { name: "Cuiabá", state: "MT", stateName: "Mato Grosso", lat: -15.6014, lng: -56.0979 },
  { name: "Florianópolis", state: "SC", stateName: "Santa Catarina", lat: -27.5954, lng: -48.548 },
  { name: "Vitória", state: "ES", stateName: "Espírito Santo", lat: -20.3155, lng: -40.3128 },
  { name: "Porto Velho", state: "RO", stateName: "Rondônia", lat: -8.7608, lng: -63.8999 },
  { name: "Macapá", state: "AP", stateName: "Amapá", lat: 0.0349, lng: -51.0694 },
  { name: "Rio Branco", state: "AC", stateName: "Acre", lat: -9.9747, lng: -67.81 },
  { name: "Boa Vista", state: "RR", stateName: "Roraima", lat: 2.8238, lng: -60.6753 },
  { name: "Palmas", state: "TO", stateName: "Tocantins", lat: -10.2491, lng: -48.3243 },
  // Major metros
  { name: "Guarulhos", state: "SP", stateName: "São Paulo", lat: -23.453, lng: -46.5333 },
  { name: "Campinas", state: "SP", stateName: "São Paulo", lat: -22.9056, lng: -47.0608 },
  { name: "Santos", state: "SP", stateName: "São Paulo", lat: -23.9608, lng: -46.3336 },
  {
    name: "São Bernardo do Campo",
    state: "SP",
    stateName: "São Paulo",
    lat: -23.6914,
    lng: -46.5646,
  },
  { name: "Santo André", state: "SP", stateName: "São Paulo", lat: -23.6637, lng: -46.5381 },
  { name: "Osasco", state: "SP", stateName: "São Paulo", lat: -23.5329, lng: -46.7916 },
  { name: "Sorocaba", state: "SP", stateName: "São Paulo", lat: -23.5015, lng: -47.4526 },
  { name: "Ribeirão Preto", state: "SP", stateName: "São Paulo", lat: -21.1699, lng: -47.8099 },
  {
    name: "São José dos Campos",
    state: "SP",
    stateName: "São Paulo",
    lat: -23.1791,
    lng: -45.8872,
  },
  { name: "Niterói", state: "RJ", stateName: "Rio de Janeiro", lat: -22.8832, lng: -43.1034 },
  {
    name: "Duque de Caxias",
    state: "RJ",
    stateName: "Rio de Janeiro",
    lat: -22.7858,
    lng: -43.3049,
  },
  { name: "Nova Iguaçu", state: "RJ", stateName: "Rio de Janeiro", lat: -22.7592, lng: -43.4511 },
  { name: "Contagem", state: "MG", stateName: "Minas Gerais", lat: -19.9317, lng: -44.0538 },
  { name: "Uberlândia", state: "MG", stateName: "Minas Gerais", lat: -18.9192, lng: -48.2773 },
  { name: "Canoas", state: "RS", stateName: "Rio Grande do Sul", lat: -29.9177, lng: -51.1839 },
  {
    name: "Caxias do Sul",
    state: "RS",
    stateName: "Rio Grande do Sul",
    lat: -29.1678,
    lng: -51.1794,
  },
  { name: "Pelotas", state: "RS", stateName: "Rio Grande do Sul", lat: -31.7654, lng: -52.3376 },
  { name: "Joinville", state: "SC", stateName: "Santa Catarina", lat: -26.3044, lng: -48.8456 },
  { name: "Blumenau", state: "SC", stateName: "Santa Catarina", lat: -26.9194, lng: -49.0661 },
  { name: "Londrina", state: "PR", stateName: "Paraná", lat: -23.3045, lng: -51.1696 },
  { name: "Maringá", state: "PR", stateName: "Paraná", lat: -23.4205, lng: -51.9333 },
  { name: "Feira de Santana", state: "BA", stateName: "Bahia", lat: -12.2664, lng: -38.9663 },
  { name: "Olinda", state: "PE", stateName: "Pernambuco", lat: -8.0089, lng: -34.8553 },
  {
    name: "Jaboatão dos Guararapes",
    state: "PE",
    stateName: "Pernambuco",
    lat: -8.169,
    lng: -35.0,
  },
  { name: "Ananindeua", state: "PA", stateName: "Pará", lat: -1.364, lng: -48.3745 },
  { name: "Aparecida de Goiânia", state: "GO", stateName: "Goiás", lat: -16.8198, lng: -49.2469 },
];

function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function label(c: LocalCity): string {
  return `${c.name}, ${c.stateName}`;
}

/** Resolve a free-text city ("sao paulo", "porto alegre, rs", …) to coordinates
 * offline. Exact/prefix match, accent- and case-insensitive. Returns null when
 * nothing matches. */
export function geocodeLocal(
  query: string,
): { label: string; latitude: number; longitude: number } | null {
  const q = normalizeText(query);
  if (q.length < 2) return null;

  for (const c of LOCAL_CITIES) {
    const name = normalizeText(c.name);
    const full = normalizeText(label(c));
    const withUf = `${name} - ${c.state.toLowerCase()}`;
    if (q === name || q === full || q === withUf || q === `${name} ${c.state.toLowerCase()}`) {
      return { label: label(c), latitude: c.lat, longitude: c.lng };
    }
  }

  // Prefix / partial match, best coverage first (longest match).
  let best: LocalCity | null = null;
  let bestScore = -1;
  for (const c of LOCAL_CITIES) {
    const name = normalizeText(c.name);
    const full = normalizeText(label(c));
    for (const candidate of [name, full]) {
      if (candidate.startsWith(q)) {
        const score = q.length / candidate.length;
        if (score > bestScore) {
          bestScore = score;
          best = c;
        }
      }
    }
  }
  return best ? { label: label(best), latitude: best.lat, longitude: best.lng } : null;
}

/** Nearest city to a coordinate — offline reverse geocode for the GPS label. */
export function reverseGeocodeLocal(lat: number, lng: number): string | null {
  let best: LocalCity | null = null;
  let bestDist = Infinity;
  for (const c of LOCAL_CITIES) {
    const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best ? label(best) : null;
}

/** City suggestions for the picker (filtered by query; top 8 when empty). */
export function suggestCities(query: string): Array<{ label: string; lat: number; lng: number }> {
  const q = normalizeText(query);
  const source =
    q.length >= 2 ? LOCAL_CITIES.filter((c) => normalizeText(label(c)).includes(q)) : LOCAL_CITIES;
  return source.slice(0, 8).map((c) => ({ label: label(c), lat: c.lat, lng: c.lng }));
}
