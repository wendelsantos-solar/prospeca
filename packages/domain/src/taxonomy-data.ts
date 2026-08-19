// Seed taxonomy — a small, data-driven starting set (NOT exhaustive).
//
// `placesTypes` are real Google Places types. `cnaeCodes` are SEED values that
// must be confirmed against a business-registry provider before being treated as
// authoritative (spec #28: never invent data) — entries we are not confident in
// intentionally leave `cnaeCodes` empty until a registry source fills them.

import type { BusinessTaxonomyEntry } from "./taxonomy.ts";

export const SEED_TAXONOMY: BusinessTaxonomyEntry[] = [
  {
    id: "barbearia",
    name: "Barbearia",
    slug: "barbearia",
    aliases: ["barbearia", "barber shop", "salão masculino", "salao masculino", "barbeiro"],
    placesTypes: ["hair_care", "beauty_salon"],
    cnaeCodes: ["9602-5/01"],
    keywords: ["barbearia", "barber"],
  },
  {
    id: "salao-beleza",
    name: "Salão de beleza",
    slug: "salao-de-beleza",
    aliases: [
      "salão de beleza",
      "salao de beleza",
      "salão",
      "cabeleireiro",
      "cabeleireira",
      "manicure",
      "esmalteria",
    ],
    placesTypes: ["beauty_salon", "hair_care"],
    cnaeCodes: ["9602-5/01"],
    keywords: ["salão", "beleza", "estética"],
  },
  {
    id: "restaurante",
    name: "Restaurante",
    slug: "restaurante",
    aliases: ["restaurante", "restaurant", "restaurantes"],
    placesTypes: ["restaurant"],
    cnaeCodes: ["5611-2/01"],
    keywords: ["restaurante", "cozinha", "gastronomia"],
  },
  {
    id: "pizzaria",
    name: "Pizzaria",
    slug: "pizzaria",
    aliases: ["pizzaria", "pizza"],
    placesTypes: ["restaurant", "meal_delivery", "meal_takeaway"],
    cnaeCodes: ["5611-2/01"],
    keywords: ["pizza", "pizzaria"],
    parentId: "restaurante",
  },
  {
    id: "lanchonete",
    name: "Lanchonete",
    slug: "lanchonete",
    aliases: ["lanchonete", "hamburgueria", "burger", "açaí", "acai", "delivery"],
    placesTypes: ["restaurant", "meal_delivery", "meal_takeaway"],
    cnaeCodes: ["5611-2/03"],
    keywords: ["lanchonete", "burger", "açaí"],
    parentId: "restaurante",
  },
  {
    id: "academia",
    name: "Academia",
    slug: "academia",
    aliases: ["academia", "gym", "crossfit", "estúdio de treino", "studio de treino"],
    placesTypes: ["gym", "fitness_center"],
    cnaeCodes: ["9313-1/00"],
    keywords: ["academia", "fitness", "crossfit"],
  },
  {
    id: "clinica-odontologica",
    name: "Clínica odontológica",
    slug: "clinica-odontologica",
    aliases: ["clínica odontológica", "clinica odontologica", "dentista", "odontologia"],
    placesTypes: ["dentist"],
    cnaeCodes: ["8630-5/03"],
    keywords: ["odontologia", "dentista", "sorriso"],
  },
  {
    id: "clinica-medica",
    name: "Clínica médica",
    slug: "clinica-medica",
    aliases: [
      "clínica médica",
      "clinica medica",
      "médico",
      "medico",
      "consultório médico",
      "consultorio medico",
    ],
    placesTypes: ["doctor", "hospital"],
    cnaeCodes: [], // 8630-5/0X — confirm exact subclass against registry
    keywords: ["medicina", "saúde", "clínica"],
  },
  {
    id: "pet-shop",
    name: "Pet shop",
    slug: "pet-shop",
    aliases: ["pet shop", "petshop", "pet", "veterinária", "veterinaria", "banho e tosa"],
    placesTypes: ["pet_store", "veterinary_care"],
    cnaeCodes: [], // 7500-1/00 (vet) vs retail subclass — confirm against registry
    keywords: ["pet", "animais", "veterinária"],
  },
  {
    id: "advocacia",
    name: "Escritório de advocacia",
    slug: "escritorio-de-advocacia",
    aliases: [
      "advocacia",
      "advogado",
      "advogada",
      "escritório de advocacia",
      "escritorio de advocacia",
    ],
    placesTypes: ["lawyer"],
    cnaeCodes: ["6911-7/01"],
    keywords: ["advocacia", "jurídico", "advogado"],
  },
  {
    id: "contabilidade",
    name: "Contabilidade",
    slug: "contabilidade",
    aliases: [
      "contabilidade",
      "contador",
      "escritório de contabilidade",
      "escritorio de contabilidade",
    ],
    placesTypes: ["accounting"],
    cnaeCodes: ["6920-6/01"],
    keywords: ["contabilidade", "contábil", "contador"],
  },
  {
    id: "farmacia",
    name: "Farmácia",
    slug: "farmacia",
    aliases: ["farmácia", "farmacia", "drogaria"],
    placesTypes: ["pharmacy", "drugstore"],
    cnaeCodes: ["4771-7/01"],
    keywords: ["farmácia", "drogaria"],
  },
];
