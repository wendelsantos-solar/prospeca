import type { Lead } from "@/types";
import { calculateScore, temperatureFromScore } from "@/lib/score";

const CITIES: Record<string, { state: string; lat: number; lng: number; neighborhoods: string[] }> =
  {
    "Porto Alegre": {
      state: "RS",
      lat: -30.0346,
      lng: -51.2177,
      neighborhoods: [
        "Centro Histórico",
        "Moinhos de Vento",
        "Cidade Baixa",
        "Menino Deus",
        "Petrópolis",
        "Bom Fim",
        "Auxiliadora",
        "Higienópolis",
      ],
    },
    "São Paulo": {
      state: "SP",
      lat: -23.5505,
      lng: -46.6333,
      neighborhoods: [
        "Pinheiros",
        "Vila Madalena",
        "Moema",
        "Itaim Bibi",
        "Jardins",
        "Vila Mariana",
        "Tatuapé",
        "Perdizes",
      ],
    },
    "Rio de Janeiro": {
      state: "RJ",
      lat: -22.9068,
      lng: -43.1729,
      neighborhoods: [
        "Copacabana",
        "Ipanema",
        "Leblon",
        "Botafogo",
        "Tijuca",
        "Barra da Tijuca",
        "Flamengo",
        "Laranjeiras",
      ],
    },
    Curitiba: {
      state: "PR",
      lat: -25.4284,
      lng: -49.2733,
      neighborhoods: ["Batel", "Água Verde", "Centro", "Cabral", "Bigorrilho", "Rebouças"],
    },
    "Belo Horizonte": {
      state: "MG",
      lat: -19.9167,
      lng: -43.9345,
      neighborhoods: ["Savassi", "Funcionários", "Lourdes", "Buritis", "Pampulha"],
    },
    Florianópolis: {
      state: "SC",
      lat: -27.5954,
      lng: -48.548,
      neighborhoods: ["Centro", "Trindade", "Lagoa da Conceição", "Ingleses", "Coqueiros"],
    },
  };

const NAME_TEMPLATES: Record<string, string[]> = {
  "Clínica médica": [
    "Clínica Nova Vida",
    "Clínica Horizonte",
    "Saúde Mais",
    "Instituto MedCare",
    "Vitalis Medicina",
  ],
  "Clínica odontológica": [
    "Odonto Prime",
    "Instituto Sorriso",
    "Sorrir Odontologia",
    "OrthoCenter",
    "DentClin",
  ],
  "Salão de beleza": [
    "Studio Bella",
    "Espaço Beauté",
    "Charme Salão",
    "Bellíssima Studio",
    "Lumière Beleza",
  ],
  Barbearia: [
    "Barbearia Central",
    "The Barber Co.",
    "Barbearia do Beto",
    "Old School Barber",
    "Barba & Cia",
  ],
  Academia: ["Academia Movimento", "Fit Club", "Corpo Forte", "Body Center", "Energy Fitness"],
  Restaurante: [
    "Restaurante Villa Verde",
    "Sabor da Casa",
    "Cantina Bella Napoli",
    "Grelha Sul",
    "Cozinha Mineira",
  ],
  "Pet shop": ["PetCare Veterinária", "Pet Amigo", "Mundo Pet", "PatinhaFeliz", "Cãopanhia Pet"],
  "Escritório de advocacia": [
    "Silva & Associados",
    "Advocacia Ferreira",
    "Costa Advogados",
    "Jurídico Brasil",
  ],
  Imobiliária: ["Imobiliária Porto Lar", "Casa Nova Imóveis", "Lar Ideal", "Imob Prime"],
  Fisioterapia: ["FisioVitta", "Espaço Equilíbrio", "Move Fisio", "Reabilita Clínica"],
  "Oficina mecânica": ["Oficina Motor Sul", "Auto Mecânica Silva", "TurboCar", "MecânicaExpress"],
  Contabilidade: ["Contábil Mais", "Precisa Contabilidade", "ProContábil", "Silva Contadores"],
  Escola: ["Escola Mundo Novo", "Colégio Aprender", "Instituto Saber", "Escola Crescer"],
  Farmácia: ["Farmácia Popular", "Drogaria Central", "FarmaVida", "Saúde Fácil"],
  Autoescola: ["Autoescola Direção", "CFC Segurança", "Autoescola Volante"],
  "Loja de veículos": ["Auto Motors", "Veículos Premium", "Multimarcas Sul"],
  "Agência de turismo": ["Turismo Aventura", "Viaja+ Turismo", "Mundo Tour"],
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function slugPhone(city: string, i: number) {
  const dd = { RS: "51", SP: "11", RJ: "21", PR: "41", MG: "31", SC: "48" }[city] ?? "11";
  const base = 90000000 + ((i * 1234567) % 9999999);
  return `+55 ${dd} 9${String(base).slice(0, 4)}-${String(base).slice(4, 8)}`;
}

let idx = 0;
function makeLead(companyName: string, category: string, cityName: string, seed: number): Lead {
  const city = CITIES[cityName];
  const rand = seededRand(seed);
  const nb = city.neighborhoods[Math.floor(rand() * city.neighborhoods.length)];
  const lat = city.lat + (rand() - 0.5) * 0.08;
  const lng = city.lng + (rand() - 0.5) * 0.08;
  const distanceKm = Number(
    Math.sqrt(Math.pow((lat - city.lat) * 111, 2) + Math.pow((lng - city.lng) * 100, 2)).toFixed(1),
  );
  const hasWebsite = rand() > 0.65;
  const hasWhatsapp = rand() > 0.25;
  const hasInstagram = rand() > 0.35;
  const hasEmail = rand() > 0.55;
  const rating = Number((3.5 + rand() * 1.5).toFixed(1));
  const reviewCount = Math.floor(rand() * 400) + 5;
  const phone = slugPhone(city.state, seed);
  const stateName =
    {
      RS: "Rio Grande do Sul",
      SP: "São Paulo",
      RJ: "Rio de Janeiro",
      PR: "Paraná",
      MG: "Minas Gerais",
      SC: "Santa Catarina",
    }[city.state] ?? city.state;
  const domainSlug = companyName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
  const partial: Partial<Lead> = {
    hasWebsite,
    whatsapp: hasWhatsapp ? phone : undefined,
    instagram: hasInstagram ? "@" + domainSlug : undefined,
    email: hasEmail ? `contato@${domainSlug}.com.br` : undefined,
    phone,
    rating,
    reviewCount,
    distanceKm,
  };
  const { score } = calculateScore(partial);
  const temperature = temperatureFromScore(score);
  const stagePool: Lead["stage"][] = ["new", "new", "new", "new", "qualified", "contacted"];
  const stage = stagePool[Math.floor(rand() * stagePool.length)];
  const discoveredAt = new Date(Date.now() - Math.floor(rand() * 30) * 86400000).toISOString();
  const streetNum = Math.floor(rand() * 4000) + 100;
  const estimatedValue = Math.floor(500 + rand() * 9500);
  idx += 1;
  return {
    id: `lead-${idx}-${seed}`,
    companyName,
    category,
    description: `${category} localizada em ${nb}, ${cityName}.`,
    address: `Rua ${["das Flores", "do Comércio", "Sete de Setembro", "XV de Novembro", "Padre Chagas", "Osvaldo Aranha"][Math.floor(rand() * 6)]}, ${streetNum}`,
    neighborhood: nb,
    city: cityName,
    state: stateName,
    latitude: lat,
    longitude: lng,
    distanceKm,
    phone,
    whatsapp: hasWhatsapp ? phone : undefined,
    email: hasEmail ? `contato@${domainSlug}.com.br` : undefined,
    instagram: hasInstagram ? "@" + domainSlug : undefined,
    website: hasWebsite ? `https://${domainSlug}.com.br` : undefined,
    hasWebsite,
    rating,
    reviewCount,
    score,
    temperature,
    stage,
    estimatedValue,
    lastInteractionAt:
      rand() > 0.6
        ? new Date(Date.now() - Math.floor(rand() * 10) * 86400000).toISOString()
        : undefined,
    discoveredAt,
    openingHours: ["Seg-Sex: 09h-18h", "Sáb: 09h-13h"],
    notes: [],
    activities: [],
    timeline: [
      { id: `t-${idx}-1`, kind: "found", label: "Lead encontrado", at: discoveredAt },
      { id: `t-${idx}-2`, kind: "enriched", label: "Dados enriquecidos", at: discoveredAt },
    ],
  };
}

export function generateLeads(): Lead[] {
  const leads: Lead[] = [];
  const cityNames = Object.keys(CITIES);
  let seed = 1;
  Object.entries(NAME_TEMPLATES).forEach(([category, names]) => {
    names.forEach((name, i) => {
      const city = cityNames[(i + seed) % cityNames.length];
      leads.push(makeLead(name, category, city, hash(name + city) + seed++));
    });
  });
  // extra to reach 50+
  const extra = [
    "Estúdio Ateliê",
    "Centro Médico Aurora",
    "Espaço Zen",
    "Casa & Estilo",
    "Motor Prime",
    "Bella Vida Salão",
    "Estética Alma",
    "Odonto Feliz",
    "Med Center",
    "Corpo em Foco",
  ];
  extra.forEach((name, i) => {
    const cat = Object.keys(NAME_TEMPLATES)[i % Object.keys(NAME_TEMPLATES).length];
    const city = cityNames[i % cityNames.length];
    leads.push(makeLead(name, cat, city, hash(name) + 999 + i));
  });
  return leads;
}

export const MOCK_LEADS = generateLeads();
