import type { Lead } from "@/types";
import type { ValueProofAllTime } from "@/repositories/types";

/**
 * "Prova de valor" — the concrete, verifiable numbers a professional can show
 * a prospect (or use to justify their own service), derived purely from the
 * org's accumulated leads. No LLM, no estimates: only what actually happened.
 */
export interface ValueProof {
  /** Negócios mapeados (total de leads no funil). */
  totalFound: number;
  /** Sem site próprio — a lacuna digital mais óbvia. */
  withoutWebsite: number;
  /** Sem nenhuma avaliação online. */
  noReviews: number;
  /** Nota média abaixo de 4,0 (reputação fraca). */
  lowRating: number;
  /** Oportunidades quentes (temperatura hot). */
  hot: number;
  /** Leads já abordados (último contato registrado). */
  contacted: number;
  /** Leads que responderam. */
  responded: number;
  /** Reuniões agendadas/realizadas. */
  meetings: number;
  /** Propostas enviadas. */
  proposals: number;
  /** Negócios fechados. */
  won: number;
  /** Receita fechada (soma dos valores). */
  revenue: number;
  /** Cidades distintas do funil. */
  cities: string[];
}

/**
 * Mapeia o bloco `allTime` do get_dashboard_overview (agregação SERVER-SIDE
 * sobre a carteira inteira — nunca array truncado) para o contrato da Prova de
 * Valor. Função pura, testável sem banco.
 */
export function valueProofFromAllTime(allTime: ValueProofAllTime): ValueProof {
  return {
    totalFound: allTime.totalFound,
    withoutWebsite: allTime.withoutWebsite,
    noReviews: allTime.noReviews,
    lowRating: allTime.lowRating,
    hot: allTime.hot,
    contacted: allTime.contacted,
    responded: allTime.responded,
    meetings: allTime.meetings,
    proposals: allTime.proposals,
    won: allTime.won,
    revenue: allTime.revenue,
    cities: [...allTime.cities].sort(),
  };
}

export function computeValueProof(leads: Lead[]): ValueProof {
  const totalFound = leads.length;
  const withoutWebsite = leads.filter((l) => !l.hasWebsite).length;
  const noReviews = leads.filter((l) => l.reviewCount === 0).length;
  const lowRating = leads.filter((l) => l.rating != null && l.rating < 4).length;
  const hot = leads.filter((l) => l.temperature === "hot").length;
  const contacted = leads.filter((l) => l.lastInteractionAt != null).length;
  const responded = leads.filter((l) => l.respondedAt != null).length;
  const meetings = leads.filter((l) => l.meetingAt != null).length;
  const proposals = leads.filter((l) => l.proposalAt != null).length;
  const won = leads.filter((l) => l.stage === "won").length;
  const revenue = leads.reduce((sum, l) => sum + (l.closedValue ?? 0), 0);
  const cities = [...new Set(leads.map((l) => l.city).filter(Boolean))].sort();
  return {
    totalFound,
    withoutWebsite,
    noReviews,
    lowRating,
    hot,
    contacted,
    responded,
    meetings,
    proposals,
    won,
    revenue,
    cities,
  };
}

/**
 * Resumo pronto para copiar/colar (WhatsApp, e-mail, proposta) — fundamentado
 * nos números reais, sem promessas. Uma frase por fato; omite o que é zero.
 */
export function valueProofSummary(vp: ValueProof): string {
  const area =
    vp.cities.length === 0
      ? "na sua região"
      : `em ${vp.cities.slice(0, 3).join(", ")}${vp.cities.length > 3 ? " e mais" : ""}`;
  const parts: string[] = [];
  parts.push(`Mapeamos ${vp.totalFound} ${vp.totalFound === 1 ? "negócio" : "negócios"} ${area}.`);
  if (vp.withoutWebsite > 0)
    parts.push(
      `${vp.withoutWebsite} ${vp.withoutWebsite === 1 ? "não tem" : "não têm"} site próprio.`,
    );
  if (vp.noReviews > 0)
    parts.push(`${vp.noReviews} ${vp.noReviews === 1 ? "não tem" : "não têm"} avaliações online.`);
  if (vp.lowRating > 0)
    parts.push(`${vp.lowRating} ${vp.lowRating === 1 ? "tem" : "têm"} nota abaixo de 4,0.`);
  if (vp.contacted > 0) {
    parts.push(
      `Já contatamos ${vp.contacted}, com ${vp.responded} ${vp.responded === 1 ? "resposta" : "respostas"}` +
        (vp.won > 0
          ? ` e ${vp.won} ${vp.won === 1 ? "negócio fechado" : "negócios fechados"}`
          : "") +
        ".",
    );
  }
  return parts.join(" ");
}
