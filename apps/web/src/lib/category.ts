// Categoria vem crua do OSM (valor de tag: amenity/shop/office/...), em inglês.
// Este helper traduz para PT-BR na exibição. O valor cru continua no banco e é
// usado para filtrar/comparar — só o rótulo mostrado ao usuário muda.

const CATEGORY_LABELS: Record<string, string> = {
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
};

/** Humaniza valor OSM desconhecido: bike_shop -> "Bike Shop". */
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
