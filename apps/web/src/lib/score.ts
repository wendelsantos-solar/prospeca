import type { Lead, LeadTemperature } from "@/types";

export interface ScoreBreakdownItem {
  label: string;
  points: number;
  explanation: string;
}

export function calculateScore(lead: Partial<Lead>): {
  score: number;
  breakdown: ScoreBreakdownItem[];
} {
  const breakdown: ScoreBreakdownItem[] = [];
  let score = 15; // base
  breakdown.push({ label: "Base", points: 15, explanation: "Pontuação inicial." });

  if (lead.hasWebsite === false) {
    score += 25;
    breakdown.push({
      label: "Sem site",
      points: 25,
      explanation: "Empresa sem presença digital tem alta oportunidade.",
    });
  }
  if (lead.whatsapp) {
    score += 20;
    breakdown.push({
      label: "WhatsApp encontrado",
      points: 20,
      explanation: "Canal direto de contato disponível.",
    });
  }
  if ((lead.rating ?? 0) >= 4) {
    score += 10;
    breakdown.push({ label: "Nota acima de 4", points: 10, explanation: "Empresa bem avaliada." });
  }
  if ((lead.reviewCount ?? 0) > 50) {
    score += 10;
    breakdown.push({
      label: "Mais de 50 avaliações",
      points: 10,
      explanation: "Volume relevante de clientes.",
    });
  }
  if ((lead.distanceKm ?? 99) < 10) {
    score += 10;
    breakdown.push({
      label: "Menos de 10 km",
      points: 10,
      explanation: "Próximo geograficamente.",
    });
  }
  if (lead.instagram) {
    score += 5;
    breakdown.push({
      label: "Instagram encontrado",
      points: 5,
      explanation: "Canal social disponível.",
    });
  }
  if (lead.email) {
    score += 5;
    breakdown.push({
      label: "E-mail encontrado",
      points: 5,
      explanation: "Canal formal disponível.",
    });
  }
  if (lead.phone) {
    score += 5;
    breakdown.push({ label: "Telefone", points: 5, explanation: "Contato telefônico disponível." });
  }

  score = Math.min(100, Math.max(0, score));
  return { score, breakdown };
}

export function temperatureFromScore(score: number): LeadTemperature {
  if (score >= 75) return "hot";
  if (score >= 45) return "warm";
  return "cold";
}
