// Business Registry — adapter contract for public business-registry sources
// (CNPJ in Brazil). Pure types + validation + mapping only: no HTTP, no Deno,
// no storage. The concrete HTTP adapter lives in the edge runtime
// (supabase/functions/_shared/business-registry.ts), mirroring the enrich.ts
// split — the domain stays dependency-free and unit-testable everywhere.

import type { CompanyStatus } from "./company.ts";

/** Normalized status of a company in a public registry. */
export const BUSINESS_REGISTRATION_STATUSES = [
  "active",
  "suspended",
  "inactive",
  "unknown",
] as const;
export type BusinessRegistrationStatus = (typeof BUSINESS_REGISTRATION_STATUSES)[number];

/** Canonical, provider-agnostic registration record (BrasilAPI → this shape). */
export interface BusinessRegistration {
  /** CNPJ, digits only (14 chars). */
  taxId: string;
  legalName: string | null;
  tradeName: string | null;
  primaryCnae: string | null;
  cnaeDescription: string | null;
  secondaryCnaes: string[];
  status: BusinessRegistrationStatus;
  /** Raw, human-readable registry status (e.g. "Ativa", "Suspensa"). */
  statusDescription: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  foundedAt: string | null;
  /** Porte da empresa (MEI, ME, EPP, Demais). */
  companySize: string | null;
  /** Natureza jurídica (raw text). */
  legalNature: string | null;
  /** Capital social em reais (BrasilAPI numeric). */
  capitalSocial: number | null;
  /** Optante pelo Simples Nacional. */
  simplesNacional: boolean | null;
  /** Data de opção pelo Simples (ISO date). */
  simplesOptedAt: string | null;
  /** Inscrito como MEI. */
  isMei: boolean | null;
  /** Quadro de sócios e administradores (QSA da BrasilAPI). null = o campo
   * não veio na resposta (cadastro sem QSA publicada). */
  qsa: Array<{ name: string; qualification: string | null }> | null;
  fetchedAt: string;
}

/**
 * A provider that resolves registration data by CNPJ. Returns null when the
 * registry has no record (unknown CNPJ); throws on provider failure so the
 * caller can distinguish "não existe" from "não consegui consultar".
 */
export interface BusinessRegistryProvider {
  lookupByCnpj(cnpj: string): Promise<BusinessRegistration | null>;
}

// ── CNPJ ────────────────────────────────────────────────────────────────────

/** Strip formatting → 14 digits. */
export function normalizeCnpj(input: string): string {
  return input.replace(/\D/g, "");
}

function cnpjCheckDigit(digits: number[], weights: number[]): number {
  const sum = weights.reduce((acc, w, i) => acc + digits[i] * w, 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

/** Checksum-validate a CNPJ (algorithm per Receita Federal). */
export function isValidCnpj(input: string): boolean {
  const cnpj = normalizeCnpj(input);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false; // all-same-digit guard
  const digits = cnpj.split("").map(Number);
  const d1 = cnpjCheckDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = cnpjCheckDigit(digits.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === digits[12] && d2 === digits[13];
}

// ── Mapping ─────────────────────────────────────────────────────────────────

/** Map BrasilAPI `situacao_cadastral` → canonical status. The API returns
 * this field as a NUMBER (RFB codes) in some payloads and as a string in
 * others — normalize both (smoke V3 found a TypeError on `.trim()`).
 *
 * RFB numeric codes: 1 = NULA · 2 = ATIVA · 3 = SUSPENSA · 4 = INAPTA ·
 * 8 = BAIXADA (the descriptions come separately in descricao_situacao). */
export function registrationStatusFromSituacao(
  situacao: string | number | null | undefined,
): BusinessRegistrationStatus {
  const raw = String(situacao ?? "").trim();
  const upper = raw.toUpperCase();
  switch (upper) {
    case "2":
    case "ATIVA":
      return "active";
    case "3":
    case "SUSPENSA":
      return "suspended";
    case "1":
    case "4":
    case "8":
    case "BAIXADA":
    case "INAPTA":
    case "NULA":
      return "inactive";
    default:
      return "unknown";
  }
}

/**
 * Registry status → canonical Company status. Suspended companies still exist
 * as going concerns (tax issue, not a closure), so they remain `operational`;
 * the nuance lives in `statusDescription`. Only definitive closures map to
 * `closed`.
 */
export function companyStatusFromRegistration(status: BusinessRegistrationStatus): CompanyStatus {
  switch (status) {
    case "active":
    case "suspended":
      return "operational";
    case "inactive":
      return "closed";
    default:
      return "unknown";
  }
}

// ── Company age (V3-D) ──────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

/** Whole years since `foundedAt` (ISO date/string) at `now`. Null when the
 * date is absent or invalid — never fabricates an age. */
export function yearsInBusiness(
  foundedAt: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!foundedAt) return null;
  const d = new Date(foundedAt);
  if (Number.isNaN(d.getTime())) return null;
  const years = (now.getTime() - d.getTime()) / (365.25 * DAY_MS);
  return years >= 0 ? Math.floor(years) : null;
}

/** Established = at least ESTABLISHED_YEARS_MIN years of operation. */
export const ESTABLISHED_YEARS_MIN = 5;

export function isEstablishedByAge(
  foundedAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const years = yearsInBusiness(foundedAt, now);
  return years != null && years >= ESTABLISHED_YEARS_MIN;
}
