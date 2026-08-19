import type { DisplayLead, Lead } from "@/types";
import { categoryLabel } from "./category";
import { contactReason, buildContactMessage, type MessageContact } from "./message-fill";
import { computeNba } from "./nba";
import { DEFAULT_MESSAGE_TEMPLATE } from "./constants";

/**
 * Relatório de Diagnóstico — the white-label PDF a professional hands to a
 * prospect as their "auditoria de presença digital". Everything is derived
 * from the lead's REAL signals (score breakdown, enrichment, NBA) — no LLM,
 * no estimates, no false claims (the product's "não vender sonho" promise).
 */

export type PresenceStatus = "ok" | "gap" | "unknown";

export interface PresenceItem {
  label: string;
  status: PresenceStatus;
  detail: string;
}

export interface DiagnosticReport {
  generatedAt: string;
  brand: { authorName: string; companyName: string };
  company: {
    name: string;
    category: string;
    location: string;
    address?: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
    instagram?: string;
    website?: string;
    rating?: number;
    reviewCount?: number;
    openingHours?: string[];
  };
  score: {
    total: number;
    temperature: "hot" | "warm" | "cold";
    temperatureLabel: string;
    temperatureHint: string;
    ruleVersion: string;
    breakdown: Array<{ label: string; points: number; reason: string }>;
  };
  presence: PresenceItem[];
  /** Concrete, grounded gaps — the "why this is an opportunity" list. */
  gaps: string[];
  nextAction: { action: string; reason: string; channel: string };
  message: string;
}

export interface ReportBranding {
  authorName?: string;
  companyName?: string;
}

const TEMPERATURE_INFO: Record<"hot" | "warm" | "cold", { label: string; hint: string }> = {
  hot: {
    label: "Oportunidade quente",
    hint: "Baixa maturidade digital e fácil de alcançar — prioridade de abordagem.",
  },
  warm: {
    label: "Oportunidade morna",
    hint: "Presença digital parcial. Vale abordar com a lacuna específica.",
  },
  cold: {
    label: "Oportunidade fria",
    hint: "Presença digital relativamente madura — menor urgência.",
  },
};

function formatRating(lead: DisplayLead): string | null {
  if (lead.rating == null) return null;
  return `${lead.rating.toFixed(1)} ★`;
}

export function buildDiagnosticReport(
  lead: DisplayLead,
  opts: { branding?: ReportBranding; template?: string } = {},
): DiagnosticReport {
  const branding = opts.branding ?? {};
  const template = opts.template ?? DEFAULT_MESSAGE_TEMPLATE;

  const location = [lead.neighborhood, lead.city, lead.state].filter(Boolean).join(", ");

  const presence: PresenceItem[] = [
    {
      label: "Site",
      status: lead.hasWebsite ? "ok" : "gap",
      detail: lead.hasWebsite ? "Possui site próprio" : "Sem site próprio",
    },
    {
      label: "Telefone",
      status: lead.phone ? "ok" : "unknown",
      detail: lead.phone ?? "Telefone não encontrado",
    },
    {
      label: "WhatsApp",
      status: lead.whatsapp ? "ok" : lead.phone ? "unknown" : "gap",
      detail: lead.whatsapp
        ? "WhatsApp disponível"
        : lead.phone
          ? "WhatsApp não confirmado"
          : "Sem WhatsApp",
    },
    {
      label: "Instagram",
      status: lead.instagram ? "ok" : "unknown",
      detail: lead.instagram ?? "Instagram não identificado",
    },
    {
      label: "E-mail",
      status: lead.email ? "ok" : "unknown",
      detail: lead.email ?? "E-mail não encontrado",
    },
    {
      label: "Reputação",
      status:
        lead.rating != null && lead.rating < 4 ? "gap" : lead.rating != null ? "ok" : "unknown",
      detail:
        lead.rating != null
          ? `${formatRating(lead)}${lead.reviewCount != null ? ` · ${lead.reviewCount} avaliações` : ""}`
          : "Sem avaliação registrada",
    },
  ];

  // Concrete gaps — only what's true, in a stable, sensible order.
  const gaps: string[] = [];
  if (!lead.hasWebsite) gaps.push("não tem site próprio");
  if (lead.rating != null && lead.rating < 4)
    gaps.push(`tem nota ${lead.rating.toFixed(1)} (abaixo de 4,0)`);
  if (lead.reviewCount === 0) gaps.push("não tem nenhuma avaliação online");
  if (!lead.whatsapp && !lead.phone) gaps.push("não tem WhatsApp nem telefone mapeado");
  if (!lead.instagram) gaps.push("não tem Instagram identificado");
  if (lead.rating == null && lead.reviewCount == null)
    gaps.push("não tem reputação online visível");
  if (gaps.length === 0) gaps.push("presença digital já relativamente completa");

  const contact: MessageContact = {
    companyName: lead.companyName,
    category: lead.category,
    city: lead.city,
    neighborhood: lead.neighborhood,
    phone: lead.phone,
    instagram: lead.instagram,
    website: lead.website,
    hasWebsite: lead.hasWebsite,
    rating: lead.rating,
    reviewCount: lead.reviewCount,
  };

  const nba = computeNba(lead);
  const temperature = lead.temperature ?? "cold";
  const tempInfo = TEMPERATURE_INFO[temperature] ?? TEMPERATURE_INFO.cold;

  return {
    generatedAt: new Date().toISOString(),
    brand: {
      authorName: branding.authorName ?? "Seu consultor",
      companyName: branding.companyName ?? "Prospeca",
    },
    company: {
      name: lead.companyName,
      category: categoryLabel(lead.category),
      location,
      address: lead.address || undefined,
      phone: lead.phone,
      whatsapp: lead.whatsapp,
      email: lead.email,
      instagram: lead.instagram,
      website: lead.website,
      rating: lead.rating,
      reviewCount: lead.reviewCount,
      openingHours: lead.openingHours,
    },
    score: {
      total: lead.score,
      temperature,
      temperatureLabel: tempInfo.label,
      temperatureHint: tempInfo.hint,
      ruleVersion: lead.scoreBreakdown?.ruleVersion ?? "—",
      breakdown: lead.scoreBreakdown?.items ?? [],
    },
    presence,
    gaps,
    nextAction: {
      action: nba.action,
      reason: nba.reason,
      channel: nba.channel,
    },
    message: buildContactMessage(template, contact, {
      senderName: branding.authorName,
      companyName: branding.companyName,
    }),
  };
}

/** The primary, always-true reason a prospect is worth a conversation. */
export function diagnosticReason(lead: Lead): string {
  return contactReason({
    companyName: lead.companyName,
    hasWebsite: lead.hasWebsite,
    rating: lead.rating,
    reviewCount: lead.reviewCount,
  });
}
