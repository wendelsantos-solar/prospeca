// Company — the canonical business entity (persisted today as `places`).
//
// Public, org-independent identity + business data. The per-org relationship
// (opportunity score, lead, notes, activities, pipeline) lives elsewhere — see
// opportunity-score.ts and the `leads` table. A Company is NOT a Lead: a company
// can exist in the discovery universe without ever entering a funnel.
//
// Data-ownership rule: canonical identity + public business data are the only
// things that belong here. Tenant-specific facts (personalized score, notes,
// activities, next-best-action) must never be written back onto the Company.

export const COMPANY_STATUSES = ["operational", "closed", "unknown"] as const;
export type CompanyStatus = (typeof COMPANY_STATUSES)[number];

/** Map a Google Places `business_status` to the canonical CompanyStatus. */
export function companyStatusFromBusinessStatus(
  businessStatus: string | null | undefined,
): CompanyStatus {
  switch (businessStatus) {
    case "OPERATIONAL":
      return "operational";
    case "CLOSED_TEMPORARILY":
    case "CLOSED_PERMANENTLY":
      return "closed";
    default:
      return "unknown";
  }
}

export interface Company {
  id: string;
  canonicalName: string;
  tradeName?: string | null;
  legalName?: string | null;
  /** CNPJ — only populated when a real business-registry source exists. */
  taxId?: string | null;
  primaryCategory?: string | null;
  primaryCnae?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  status: CompanyStatus;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastEnrichedAt?: string | null;
}

export const COMPANY_SOURCE_PROVIDERS = [
  "google_places",
  "public_business_registry",
  "website",
  "instagram",
  "facebook",
  "whatsapp",
  "manual",
] as const;
export type CompanySourceProvider = (typeof COMPANY_SOURCE_PROVIDERS)[number];

export interface CompanySource {
  id: string;
  companyId: string;
  provider: CompanySourceProvider;
  providerExternalId?: string | null;
  /** "search" | "details" | "enrichment" | … */
  sourceType: string;
  /** Storage reference to a capped raw snapshot — never the raw payload itself. */
  rawSnapshotRef?: string | null;
  fetchedAt: string;
  expiresAt?: string | null;
  /** 0..1 — how much we trust this source for this field. */
  confidence: number;
}

/** A source is stale once past its retention horizon (no expiry = never stale). */
export function isSourceStale(
  source: Pick<CompanySource, "expiresAt">,
  now: Date = new Date(),
): boolean {
  if (!source.expiresAt) return false;
  return new Date(source.expiresAt).getTime() <= now.getTime();
}
