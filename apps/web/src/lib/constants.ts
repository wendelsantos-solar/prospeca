export const APP_NAME = "Radar Local";
export const APP_TAGLINE = "Encontre, qualifique e converta negócios locais";

export const BULK_SELECTION_LIMIT = 10;

export const STORAGE_KEY = "radar-local/v1";

export const DEFAULT_MESSAGE_TEMPLATE = `Olá! Encontrei a {{empresa}} enquanto pesquisava empresas de {{categoria}} em {{cidade}}. Gostaria de conversar rapidamente sobre uma oportunidade que pode ajudar o seu negócio.`;

export const RADIUS_OPTIONS = [1, 5, 10, 20, 30, 50, 100] as const;

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

export const CITY_SUGGESTIONS = [
  { label: "Porto Alegre, Rio Grande do Sul", lat: -30.0346, lng: -51.2177 },
  { label: "Canoas, Rio Grande do Sul", lat: -29.9177, lng: -51.1839 },
  { label: "São Paulo, São Paulo", lat: -23.5505, lng: -46.6333 },
  { label: "Rio de Janeiro, Rio de Janeiro", lat: -22.9068, lng: -43.1729 },
  { label: "Curitiba, Paraná", lat: -25.4284, lng: -49.2733 },
  { label: "Belo Horizonte, Minas Gerais", lat: -19.9167, lng: -43.9345 },
  { label: "Florianópolis, Santa Catarina", lat: -27.5954, lng: -48.548 },
  { label: "Brasília, Distrito Federal", lat: -15.7801, lng: -47.9292 },
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

export const HOME_SUGGESTIONS = [
  {
    label: "Clínicas sem site em Porto Alegre",
    niche: "Clínica médica",
    location: "Porto Alegre, Rio Grande do Sul",
    lat: -30.0346,
    lng: -51.2177,
    presence: "no-website" as const,
  },
  {
    label: "Barbearias no Rio de Janeiro",
    niche: "Barbearia",
    location: "Rio de Janeiro, Rio de Janeiro",
    lat: -22.9068,
    lng: -43.1729,
    presence: "all" as const,
  },
  {
    label: "Academias em São Paulo",
    niche: "Academia",
    location: "São Paulo, São Paulo",
    lat: -23.5505,
    lng: -46.6333,
    presence: "all" as const,
  },
  {
    label: "Escritórios de advocacia em Curitiba",
    niche: "Escritório de advocacia",
    location: "Curitiba, Paraná",
    lat: -25.4284,
    lng: -49.2733,
    presence: "no-website" as const,
  },
];

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
