/**
 * Marketing demo data — fictitious, realistic, reusable across landing sections.
 * These same leads appear consistently in map, score, list, pipeline, and messaging
 * demos to create a continuous narrative.
 *
 * No real phone numbers, emails, or personal data. Marked as demo.
 */

export interface DemoLead {
  id: string;
  companyName: string;
  category: string;
  score: number;
  temperature: "hot" | "warm" | "cold";
  address: string;
  distanceKm: number;
  hasWebsite: boolean;
  hasPhone: boolean;
  hasWhatsapp: boolean;
  hasInstagram: boolean;
  rating: number | null;
  reviewCount: number | null;
  stage: "new" | "qualified" | "contacted" | "won" | "discarded";
  assignedTo: string | null;
  estimatedValue: number | null;
  nextAction: string | null;
  contactName: string | null;
}

export const DEMO_LEADS: DemoLead[] = [
  {
    id: "demo-001",
    companyName: "Rústica Barbearia",
    category: "Barbearia",
    score: 89,
    temperature: "hot",
    address: "Av. das Américas, 3500 — Barra da Tijuca, Rio de Janeiro",
    distanceKm: 2.1,
    hasWebsite: false,
    hasPhone: true,
    hasWhatsapp: true,
    hasInstagram: true,
    rating: 4.9,
    reviewCount: 234,
    stage: "qualified",
    assignedTo: "Ana",
    estimatedValue: 2800,
    nextAction: "Enviar proposta de site",
    contactName: "Marcos",
  },
  {
    id: "demo-002",
    companyName: "Clínica Horizonte",
    category: "Clínica odontológica",
    score: 76,
    temperature: "warm",
    address: "Rua Barão da Torre, 180 — Ipanema, Rio de Janeiro",
    distanceKm: 3.8,
    hasWebsite: true,
    hasPhone: true,
    hasWhatsapp: false,
    hasInstagram: true,
    rating: 4.3,
    reviewCount: 87,
    stage: "new",
    assignedTo: null,
    estimatedValue: null,
    nextAction: "Qualificar interesse",
    contactName: "Dra. Patrícia",
  },
  {
    id: "demo-003",
    companyName: "Studio Aurora",
    category: "Estúdio de pilates",
    score: 64,
    temperature: "warm",
    address: "Rua Visconde de Pirajá, 500 — Ipanema, Rio de Janeiro",
    distanceKm: 4.5,
    hasWebsite: true,
    hasPhone: true,
    hasWhatsapp: true,
    hasInstagram: true,
    rating: 4.7,
    reviewCount: 156,
    stage: "contacted",
    assignedTo: "Carlos",
    estimatedValue: 1500,
    nextAction: "Retornar na quinta",
    contactName: "Júlia",
  },
  {
    id: "demo-004",
    companyName: "Café da Praça",
    category: "Cafeteria",
    score: 55,
    temperature: "cold",
    address: "Praça Santos Dumont, 80 — Gávea, Rio de Janeiro",
    distanceKm: 5.2,
    hasWebsite: true,
    hasPhone: false,
    hasWhatsapp: false,
    hasInstagram: false,
    rating: 4.1,
    reviewCount: 42,
    stage: "discarded",
    assignedTo: "Ana",
    estimatedValue: null,
    nextAction: null,
    contactName: null,
  },
  {
    id: "demo-005",
    companyName: "Oficina Central",
    category: "Oficina mecânica",
    score: 81,
    temperature: "hot",
    address: "Rua São Clemente, 250 — Botafogo, Rio de Janeiro",
    distanceKm: 6.0,
    hasWebsite: false,
    hasPhone: true,
    hasWhatsapp: true,
    hasInstagram: false,
    rating: 4.6,
    reviewCount: 312,
    stage: "new",
    assignedTo: null,
    estimatedValue: 3500,
    nextAction: "Entrar em contato",
    contactName: "Roberto",
  },
  {
    id: "demo-006",
    companyName: "Doce Confeitaria",
    category: "Confeitaria",
    score: 72,
    temperature: "warm",
    address: "Rua Dias Ferreira, 120 — Leblon, Rio de Janeiro",
    distanceKm: 7.3,
    hasWebsite: true,
    hasPhone: true,
    hasWhatsapp: true,
    hasInstagram: true,
    rating: 4.8,
    reviewCount: 198,
    stage: "won",
    assignedTo: "Carlos",
    estimatedValue: 4200,
    nextAction: null,
    contactName: "Fernanda",
  },
  {
    id: "demo-007",
    companyName: "Pet Shop Amigo Fiel",
    category: "Pet shop",
    score: 68,
    temperature: "warm",
    address: "Rua Voluntários da Pátria, 400 — Botafogo, Rio de Janeiro",
    distanceKm: 4.0,
    hasWebsite: false,
    hasPhone: true,
    hasWhatsapp: true,
    hasInstagram: true,
    rating: 4.4,
    reviewCount: 76,
    stage: "qualified",
    assignedTo: "Ana",
    estimatedValue: 1800,
    nextAction: "Apresentar portfólio",
    contactName: "Ricardo",
  },
  {
    id: "demo-008",
    companyName: "Academia Corpo Livre",
    category: "Academia",
    score: 58,
    temperature: "cold",
    address: "Av. Ayrton Senna, 2000 — Barra da Tijuca, Rio de Janeiro",
    distanceKm: 8.1,
    hasWebsite: true,
    hasPhone: false,
    hasWhatsapp: false,
    hasInstagram: true,
    rating: 3.9,
    reviewCount: 53,
    stage: "new",
    assignedTo: null,
    estimatedValue: null,
    nextAction: null,
    contactName: null,
  },
];

export const PIPELINE_STAGES = [
  { key: "new", label: "Novo", count: 12 },
  { key: "qualified", label: "Qualificado", count: 5 },
  { key: "contacted", label: "Contatado", count: 3 },
  { key: "won", label: "Ganho", count: 1 },
  { key: "discarded", label: "Descartado", count: 2 },
] as const;

export const SCORE_CRITERIA = [
  { label: "Não possui site", points: 30, icon: "Globe" as const },
  { label: "Telefone válido encontrado", points: 20, icon: "Phone" as const },
  { label: "WhatsApp disponível", points: 12, icon: "MessageCircle" as const },
  { label: "Boa avaliação (>4.0)", points: 10, icon: "Star" as const },
  { label: "Até 5 km de distância", points: 8, icon: "MapPin" as const },
  { label: "Categoria identificada", points: 3, icon: "Tag" as const },
  { label: "Possui Instagram", points: 5, icon: "Camera" as const },
] as const;

export const DEMO_SEARCH = {
  niche: "Barbearia",
  location: "Barra da Tijuca, Rio de Janeiro",
  radiusKm: 10,
  resultsCount: 34,
};
