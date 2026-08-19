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
  qsa: QsaMember[] | null;
  /** Matriz ou filial do CNPJ consultado. */
  establishmentType: EstablishmentType;
  /** Logradouro + número + complemento do endereço OFICIAL (registro). */
  streetAddress: string | null;
  /** Bairro do endereço oficial. */
  district: string | null;
  fetchedAt: string;
}

/** Matriz / filial (RFB `identificador_matriz_filial`: 1 = matriz, 2 = filial). */
export const ESTABLISHMENT_TYPES = ["headquarters", "branch", "unknown"] as const;
export type EstablishmentType = (typeof ESTABLISHMENT_TYPES)[number];

/**
 * Natureza do integrante do QSA (RFB `identificador_de_socio`:
 * 1 = pessoa jurídica, 2 = pessoa física, 3 = estrangeiro). Importa para
 * People Intelligence: uma PJ sócia NÃO é uma pessoa decisora — quem decide,
 * nesse caso, é o representante legal informado na própria linha.
 */
export const QSA_MEMBER_TYPES = ["company", "person", "foreign", "unknown"] as const;
export type QsaMemberType = (typeof QSA_MEMBER_TYPES)[number];

/**
 * Um integrante do QSA, já normalizado e MINIMIZADO.
 *
 * PRIVACIDADE (brief §25): CPF/CNPJ do sócio (`cnpj_cpf_do_socio`), CPF do
 * representante legal (`cpf_representante_legal`) e faixa etária
 * (`faixa_etaria`/`codigo_faixa_etaria`) são DESCARTADOS na origem — nunca
 * entram no sistema, nem mascarados. Não há utilidade comercial que justifique
 * reter identificador fiscal de pessoa física ou dado etário.
 */
export interface QsaMember {
  /** Nome do sócio/administrador — dado público do quadro societário. */
  name: string;
  /** Qualificação textual da Receita (ex.: "Sócio-Administrador"). */
  qualification: string | null;
  /** Código RFB da qualificação — base DETERMINÍSTICA da classificação de
   * decisor (o texto varia; o código não). */
  qualificationCode: string | null;
  /** Data de entrada na sociedade (ISO date), quando informada. */
  since: string | null;
  memberType: QsaMemberType;
  /** Representante legal, quando a fonte informa (sócio PJ ou incapaz). */
  legalRepresentativeName: string | null;
  legalRepresentativeQualification: string | null;
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

// ── Descoberta de CNPJ no site da empresa ───────────────────────────────────
//
// O gargalo da inteligência empresarial não é consultar o CNPJ — é SABER o
// CNPJ. O Google Places não fornece, e pedir para o usuário digitar não
// escala. A fonte honesta e gratuita é o site da própria empresa: no Brasil o
// CNPJ costuma estar no rodapé, nos termos ou na página institucional.
//
// O HTML já é baixado pelo enricher de contato (email/instagram/whatsapp), de
// modo que extrair o CNPJ dali custa ZERO requisição nova.
//
// ARMADILHA CONHECIDA: rodapé brasileiro frequentemente traz o CNPJ da AGÊNCIA
// que fez o site ("Desenvolvido por Fulano — CNPJ ..."). Gravar esse número
// faria o Prospeca exibir a empresa errada com cara de dado oficial. Por isso
// candidatos precedidos por marcador de autoria são descartados, e o que
// sobra é CANDIDATO — quem confirma é a consulta ao registro.

/** Trechos que denunciam CNPJ de terceiro (agência/plataforma), não da empresa. */
export const CNPJ_THIRD_PARTY_MARKERS = [
  "desenvolvido por",
  "desenvolvimento por",
  "criado por",
  "site por",
  "feito por",
  "powered by",
  "developed by",
  "agencia",
  "agência",
] as const;

/** Quantos caracteres antes do CNPJ são inspecionados em busca do marcador. */
const MARKER_WINDOW = 120;

/**
 * CNPJs plausíveis num HTML, em ordem de aparição, sem repetição.
 *
 * Aceita as formas escritas na prática (`00.000.000/0000-00`, `00000000000000`
 * e mistas) e valida por CHECKSUM — um número de 14 dígitos qualquer (telefone
 * concatenado, id de produto) não passa. Números precedidos por marcador de
 * autoria são descartados.
 */
export function extractCnpjCandidates(html: string): string[] {
  if (!html) return [];
  // Fronteiras com (?<!\d) / (?!\d) impedem casar um pedaço de um número maior.
  const pattern = /(?<!\d)(\d{2})\.?(\d{3})\.?(\d{3})\/?(\d{4})-?(\d{2})(?!\d)/g;
  const seen = new Set<string>();
  const out: string[] = [];

  for (const match of html.matchAll(pattern)) {
    const candidate = match.slice(1, 6).join("");
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    if (!isValidCnpj(candidate)) continue;

    const start = Math.max(0, (match.index ?? 0) - MARKER_WINDOW);
    const context = html
      .slice(start, match.index ?? 0)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    if (CNPJ_THIRD_PARTY_MARKERS.some((marker) => context.includes(marker))) continue;

    out.push(candidate);
  }
  return out;
}

/**
 * Confiança de um CNPJ achado no site da própria empresa.
 *
 * Deliberadamente < 1 e menor ainda quando o site lista VÁRIOS CNPJs: com mais
 * de um número plausível na página, escolher o primeiro é um palpite razoável,
 * não um fato. A confirmação vem do registro (razão social batendo com o nome
 * da empresa), nunca do próprio HTML.
 */
export const WEBSITE_CNPJ_CONFIDENCE = {
  single: 0.75,
  multiple: 0.5,
} as const;

export function websiteCnpjConfidence(candidateCount: number): number {
  return candidateCount > 1 ? WEBSITE_CNPJ_CONFIDENCE.multiple : WEBSITE_CNPJ_CONFIDENCE.single;
}

// ── BrasilAPI mapping ───────────────────────────────────────────────────────
//
// O shape CRU da BrasilAPI (`GET /api/cnpj/v1/{cnpj}`) e a tradução dele para
// o DTO canônico vivem aqui, puros e testáveis — o adapter HTTP
// (supabase/functions/_shared/business-registry.ts) só faz rede e delega.
//
// Este módulo existe porque o mapeamento do QSA estava ERRADO em produção: o
// adapter lia `nome`/`qual`, chaves que a API não devolve (ela devolve
// `nome_socio`/`qualificacao_socio`), então TODO sócio era descartado e
// `places.qsa` gravava sempre `[]`. Mapeamento sem teste é mapeamento quebrado
// em silêncio; a partir daqui ele é coberto.

export interface BrasilApiQsaMember {
  nome_socio?: string;
  qualificacao_socio?: string;
  codigo_qualificacao_socio?: number | string;
  data_entrada_sociedade?: string;
  identificador_de_socio?: number | string;
  nome_representante_legal?: string;
  qualificacao_representante_legal?: string;
  /** PII — presente na resposta, DELIBERADAMENTE não mapeado. */
  cnpj_cpf_do_socio?: string;
  cpf_representante_legal?: string;
  faixa_etaria?: string;
  codigo_faixa_etaria?: number;
}

export interface BrasilApiCnpjPayload {
  razao_social?: string;
  nome_fantasia?: string | null;
  cnae_fiscal?: number | string;
  cnae_fiscal_descricao?: string;
  cnaes_secundarios?: Array<{ codigo?: number | string; descricao?: string } | number | string>;
  situacao_cadastral?: string | number;
  descricao_situacao_cadastral?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  identificador_matriz_filial?: number | string;
  ddd_telefone_1?: string;
  email?: string;
  data_inicio_atividade?: string;
  porte?: string;
  natureza_juridica?: string;
  capital_social?: number;
  opcao_pelo_simples?: boolean;
  data_opcao_pelo_simples?: string;
  opcao_pelo_mei?: boolean;
  qsa?: BrasilApiQsaMember[];
}

export function establishmentTypeFromIdentifier(
  identifier: number | string | null | undefined,
): EstablishmentType {
  switch (String(identifier ?? "").trim()) {
    case "1":
      return "headquarters";
    case "2":
      return "branch";
    default:
      return "unknown";
  }
}

export function qsaMemberTypeFromIdentifier(
  identifier: number | string | null | undefined,
): QsaMemberType {
  switch (String(identifier ?? "").trim()) {
    case "1":
      return "company";
    case "2":
      return "person";
    case "3":
      return "foreign";
    default:
      return "unknown";
  }
}

const trimmed = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
  return s.length > 0 ? s : null;
};

/**
 * Endereço oficial em uma linha: "Logradouro, 123 - Sala 4". Só compõe com o
 * que a fonte respondeu — nunca inventa vírgula/traço para parte ausente.
 */
export function composeStreetAddress(
  street: string | null | undefined,
  number: string | null | undefined,
  complement: string | null | undefined,
): string | null {
  const st = trimmed(street);
  const num = trimmed(number);
  const comp = trimmed(complement);
  if (!st && !num && !comp) return null;
  const head = [st, num].filter(Boolean).join(", ");
  return [head || null, comp].filter(Boolean).join(" - ") || null;
}

/** Um integrante do QSA da BrasilAPI → QsaMember, sem PII. */
export function mapBrasilApiQsaMember(raw: BrasilApiQsaMember): QsaMember | null {
  const name = trimmed(raw.nome_socio);
  if (!name) return null; // linha sem nome não descreve ninguém
  return {
    name,
    qualification: trimmed(raw.qualificacao_socio),
    qualificationCode: trimmed(raw.codigo_qualificacao_socio),
    since: trimmed(raw.data_entrada_sociedade),
    memberType: qsaMemberTypeFromIdentifier(raw.identificador_de_socio),
    legalRepresentativeName: trimmed(raw.nome_representante_legal),
    legalRepresentativeQualification: trimmed(raw.qualificacao_representante_legal),
  };
}

/**
 * Payload cru da BrasilAPI → BusinessRegistration canônico.
 *
 * `taxId` vem do CHAMADOR (o CNPJ normalizado que foi consultado), não do
 * corpo da resposta — o que foi perguntado é a chave, e a resposta pode
 * formatá-lo de outro jeito.
 */
export function mapBrasilApiCnpj(
  taxId: string,
  raw: BrasilApiCnpjPayload,
  fetchedAt: string,
): BusinessRegistration {
  return {
    taxId,
    legalName: trimmed(raw.razao_social),
    tradeName: trimmed(raw.nome_fantasia),
    primaryCnae: trimmed(raw.cnae_fiscal),
    cnaeDescription: trimmed(raw.cnae_fiscal_descricao),
    secondaryCnaes: (raw.cnaes_secundarios ?? [])
      .map((c) => (typeof c === "object" && c !== null ? trimmed(c.codigo) : trimmed(c)))
      .filter((c): c is string => Boolean(c)),
    status: registrationStatusFromSituacao(raw.situacao_cadastral),
    statusDescription: trimmed(raw.descricao_situacao_cadastral) ?? trimmed(raw.situacao_cadastral),
    city: trimmed(raw.municipio),
    state: trimmed(raw.uf),
    postalCode: trimmed(raw.cep),
    streetAddress: composeStreetAddress(raw.logradouro, raw.numero, raw.complemento),
    district: trimmed(raw.bairro),
    establishmentType: establishmentTypeFromIdentifier(raw.identificador_matriz_filial),
    // A BrasilAPI só expõe o DDD (telefone completo é endpoint pago) — guardado
    // para um futuro enrichment de telefone, NUNCA tratado como número completo.
    phone: trimmed(raw.ddd_telefone_1),
    email: trimmed(raw.email),
    foundedAt: trimmed(raw.data_inicio_atividade),
    companySize: trimmed(raw.porte),
    legalNature: trimmed(raw.natureza_juridica),
    capitalSocial: typeof raw.capital_social === "number" ? raw.capital_social : null,
    simplesNacional: raw.opcao_pelo_simples ?? null,
    simplesOptedAt: trimmed(raw.data_opcao_pelo_simples),
    isMei: raw.opcao_pelo_mei ?? null,
    // `qsa` ausente na resposta = "não sei" (null). Presente e vazio = "a fonte
    // diz que não há quadro societário publicado" ([]). Distinção preservada.
    qsa: Array.isArray(raw.qsa)
      ? raw.qsa.map(mapBrasilApiQsaMember).filter((m): m is QsaMember => m !== null)
      : null,
    fetchedAt,
  };
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
