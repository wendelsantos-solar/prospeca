// Categoria vem crua do provedor (Google `primaryType`, ou tag OSM legada em
// linhas antigas). Este helper traduz para PT-BR na exibição. O valor cru
// continua no banco e é usado para filtrar/comparar — só o rótulo muda.
// Chaves OSM (hairdresser, clinic...) MANTIDAS para compat de leitura de linhas
// legadas `source=overpass` (não migramos); chaves Google (barber_shop,
// dental_clinic...) adicionadas para o caminho atual.

const CATEGORY_LABELS: Record<string, string> = {
  // ── OSM (legado — linhas source=overpass) ──
  // office
  accountant: "Contabilidade",
  lawyer: "Advocacia",
  // healthcare / amenity
  clinic: "Clínica",
  doctors: "Consultório médico",
  dentist: "Dentista",
  veterinary: "Veterinário",
  pharmacy: "Farmácia",
  hospital: "Hospital",
  // alimentação
  restaurant: "Restaurante",
  fast_food: "Lanchonete",
  cafe: "Cafeteria",
  bakery: "Padaria",
  bar: "Bar",
  pub: "Bar",
  ice_cream: "Sorveteria",
  // beleza / bem-estar
  hairdresser: "Cabeleireiro",
  beauty: "Estética",
  fitness_centre: "Academia",
  sports_centre: "Centro esportivo",
  // comércio comum (shop~".")
  supermarket: "Supermercado",
  convenience: "Mercearia",
  clothes: "Loja de roupas",
  shoes: "Sapataria",
  jewelry: "Joalheria",
  furniture: "Móveis",
  hardware: "Materiais de construção",
  florist: "Floricultura",
  butcher: "Açougue",
  greengrocer: "Hortifruti",
  optician: "Ótica",
  books: "Livraria",
  car_repair: "Oficina mecânica",
  car: "Concessionária",
  pet: "Pet shop",
  mobile_phone: "Celulares",
  electronics: "Eletrônicos",
  // serviços / outros
  hotel: "Hotel",
  school: "Escola",
  bank: "Banco",

  // ── Google Places `primaryType` (caminho atual) ──
  // beleza / bem-estar
  barber_shop: "Barbearia",
  hair_salon: "Cabeleireiro",
  hair_care: "Cabeleireiro",
  beauty_salon: "Salão de beleza",
  nail_salon: "Manicure",
  spa: "Spa",
  gym: "Academia",
  fitness_center: "Academia",
  sports_activity_location: "Centro esportivo",
  // saúde
  doctor: "Consultório médico",
  dental_clinic: "Clínica odontológica",
  physiotherapist: "Fisioterapia",
  veterinary_care: "Veterinário",
  drugstore: "Farmácia",
  medical_lab: "Laboratório",
  // alimentação
  coffee_shop: "Cafeteria",
  meal_takeaway: "Lanchonete",
  fast_food_restaurant: "Lanchonete",
  ice_cream_shop: "Sorveteria",
  // comércio
  convenience_store: "Mercearia",
  clothing_store: "Loja de roupas",
  shoe_store: "Sapataria",
  jewelry_store: "Joalheria",
  furniture_store: "Móveis",
  hardware_store: "Materiais de construção",
  book_store: "Livraria",
  car_dealer: "Concessionária",
  car_wash: "Lava-rápido",
  pet_store: "Pet shop",
  cell_phone_store: "Celulares",
  electronics_store: "Eletrônicos",
  // serviços / outros
  accounting: "Contabilidade",
  real_estate_agency: "Imobiliária",
  insurance_agency: "Seguros",
  lodging: "Hotel",
};

/** Humaniza valor de tipo desconhecido: bike_shop -> "Bike Shop". */
function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Rótulo PT-BR para uma categoria OSM crua. Vazio/nulo -> "". */
export function categoryLabel(value: string | null | undefined): string {
  if (!value) return "";
  return CATEGORY_LABELS[value.toLowerCase()] ?? humanize(value);
}
