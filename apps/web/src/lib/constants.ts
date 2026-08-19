import { geocodeLocal } from "./local-geocoding";

export const BULK_SELECTION_LIMIT = 10;

export const STORAGE_KEY = "radar-local/v1";

export const DEFAULT_MESSAGE_TEMPLATE = `Olá! Encontrei a {{empresa}} e vi que {{razao_contato}}. Posso te mostrar rapidamente como melhorar isso e atrair mais clientes?`;

// Teto = 50km, NÃO escolha nossa: o Places API (New) documenta
// "The radius must be within [0.0, 50000.0]" para Circle.radius
// (nearbySearch), e o provider aplica Math.min(radiusMeters, 50000) nos dois
// modos de busca (_shared/google.ts). Oferecer mais que isso na UI prometia
// cobertura que a busca nunca entregava (LOTE 2, Tarefa 1).
export const RADIUS_OPTIONS = [1, 5, 10, 20, 30, 50] as const;

export const NICHES = [
  "Clínica médica",
  "Clínica odontológica",
  "Salão de beleza",
  "Barbearia",
  "Academia",
  "Restaurante",
  "Pet shop",
  "Escritório de advocacia",
  "Imobiliária",
  "Loja de veículos",
  "Escola",
  "Farmácia",
  "Fisioterapia",
  "Contabilidade",
  "Autoescola",
  "Oficina mecânica",
  "Agência de turismo",
];

export const STAGE_LABELS = {
  new: "Novo",
  qualified: "Qualificado",
  contacted: "Contatado",
  won: "Ganho",
  discarded: "Descartado",
} as const;

export const STAGE_ORDER = ["new", "qualified", "contacted", "won", "discarded"] as const;

export const TEMPERATURE_LABELS = {
  hot: "Quente",
  warm: "Morno",
  cold: "Frio",
} as const;

export const DISCARD_REASONS = [
  "Sem interesse",
  "Contato inválido",
  "Empresa encerrada",
  "Já possui fornecedor",
  "Fora do perfil",
  "Sem resposta",
  "Duplicado",
  "Outro",
];

export const SEARCH_STEPS = [
  "Localizando a região",
  "Buscando estabelecimentos",
  "Analisando presença digital",
  "Verificando telefones e WhatsApp",
  "Enriquecendo os leads",
  "Calculando oportunidades",
  "Organizando os resultados",
];

export const PERIOD_OPTIONS = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "year", label: "Este ano" },
  { value: "custom", label: "Personalizado" },
] as const;

type HomeSuggestion = {
  label: string;
  niche: string;
  location: string;
  lat: number;
  lng: number;
  presence: "no-website" | "with-website" | "all";
};

// Sugestões da home derivam as coordenadas do catálogo offline de cidades
// (local-geocoding), a mesma fonte do buscador lateral e do onboarding — assim
// uma mudança de cidade nunca fica fora de sync entre as superfícies.
function suggestion(
  label: string,
  niche: string,
  city: string,
  presence: HomeSuggestion["presence"],
): HomeSuggestion | null {
  const c = geocodeLocal(city);
  if (!c) return null;
  return { label, niche, location: c.label, lat: c.latitude, lng: c.longitude, presence };
}

export const HOME_SUGGESTIONS: HomeSuggestion[] = [
  suggestion("Clínicas sem site em Porto Alegre", "Clínica médica", "Porto Alegre", "no-website"),
  suggestion("Barbearias no Rio de Janeiro", "Barbearia", "Rio de Janeiro", "all"),
  suggestion("Academias em São Paulo", "Academia", "São Paulo", "all"),
  suggestion(
    "Escritórios de advocacia em Curitiba",
    "Escritório de advocacia",
    "Curitiba",
    "no-website",
  ),
].filter((s): s is HomeSuggestion => s !== null);

export const SORT_OPTIONS = [
  { value: "relevance", label: "Relevância" },
  { value: "score-desc", label: "Maior score" },
  { value: "rating-desc", label: "Melhor avaliação" },
  { value: "reviews-desc", label: "Mais avaliações" },
  { value: "distance-asc", label: "Mais próximo" },
  { value: "recent", label: "Mais recente" },
  { value: "name-asc", label: "Nome de A a Z" },
  { value: "name-desc", label: "Nome de Z a A" },
  { value: "value-desc", label: "Maior valor estimado" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];
