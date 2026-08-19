// Website enricher — extracts contact signals from a lead's OWN website only.
// No search-engine scraping, no third-party crawling. SSRF-guarded, timed out,
// single page. Returns explicit not_found signals rather than fabricating data.
import { assertSafeUrl, isPrivateIpv4, isPrivateIpv6, SsrfBlockedError } from "@leads/domain/ssrf";
import { instagramHandleFromUrl, normalizeDomain } from "@leads/domain/normalize";
import { extractCnpjCandidates } from "@leads/domain/business-registry";

const MAX_REDIRECTS = 3;

// assertSafeUrl only rejects literal hostnames (IPs, localhost, .internal).
// A hostname that LOOKS public can still resolve to a private/metadata IP
// (DNS rebinding), and a "safe" host can 302 to an unsafe one on the next
// hop. Both must be re-checked with the actual resolved address.
async function resolvesToPrivateIp(hostname: string): Promise<boolean> {
  try {
    const [a, aaaa] = await Promise.all([
      Deno.resolveDns(hostname, "A").catch(() => [] as string[]),
      Deno.resolveDns(hostname, "AAAA").catch(() => [] as string[]),
    ]);
    const ips = [...a, ...aaaa];
    if (ips.length === 0) return true; // unresolvable — fail closed
    return ips.some((ip) => isPrivateIpv4(ip) || isPrivateIpv6(ip));
  } catch {
    return true; // fail closed
  }
}

async function assertSafeUrlResolved(rawUrl: string): Promise<URL> {
  const url = assertSafeUrl(rawUrl);
  if (await resolvesToPrivateIp(url.hostname)) {
    throw new SsrfBlockedError(`resolved host is private: ${url.hostname}`);
  }
  return url;
}

/** fetch() with redirect:"follow" never re-validates the target host on each
 * hop — an attacker's own site can 302 straight into a private network. Walk
 * the chain manually, SSRF-checking (literal + resolved IP) at every step. */
async function safeFetch(startUrl: URL, init: RequestInit): Promise<Response> {
  let url = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(url.toString(), { ...init, redirect: "manual" });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      url = await assertSafeUrlResolved(new URL(location, url).toString());
      continue;
    }
    return res;
  }
  throw new SsrfBlockedError("too many redirects");
}

export type EnrichmentField = "website" | "phone" | "whatsapp" | "email" | "instagram" | "address";

export interface EnrichedField {
  field: EnrichmentField;
  value: string;
  confidence: number;
  verification: "unverified" | "verified" | "not_found";
  sourceUrl: string | null;
  provider: string;
}

export type EnrichmentStatus = "ok" | "not_found" | "blocked" | "error";

/** Per-field result of one enrichment pass. `status` mirrors the field's
 * lifecycle: complete = checked (has true/false), failed = provider errored on
 * it. Fields absent from the outcome list were never checked (pending). */
export interface EnrichmentFieldOutcome {
  field: "email" | "instagram" | "whatsapp" | "phone";
  status: "complete" | "failed";
  has: boolean;
  value: string | null;
  confidence: number | null;
}

const PROVIDER = "website_scraper";

function extract(html: string, pageUrl: string): EnrichedField[] {
  const out: EnrichedField[] = [];
  const push = (field: EnrichmentField, value: string, confidence: number) =>
    out.push({
      field,
      value,
      confidence,
      verification: "unverified",
      sourceUrl: pageUrl,
      provider: PROVIDER,
    });

  const email = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0];
  if (email && !/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(email))
    push("email", email.toLowerCase(), 0.6);

  const insta = html.match(/instagram\.com\/([A-Za-z0-9_.]+)/)?.[1];
  if (insta && !["p", "reel", "explore"].includes(insta)) push("instagram", `@${insta}`, 0.7);

  const wa = html.match(/(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)(\d{10,15})/)?.[1];
  if (wa) push("whatsapp", wa, 0.7);

  const tel = html.match(/tel:\+?([\d\s()-]{8,20})/)?.[1];
  if (tel) push("phone", tel.replace(/[^\d+]/g, ""), 0.5);

  return out;
}

const OUTCOME_FIELDS = ["email", "instagram", "whatsapp", "phone"] as const;

/** Build per-field outcomes for a successful fetch: every candidate field is
 * "complete" (it was checked), with `has` reflecting whether a value was found. */
function outcomesFromFound(fields: EnrichedField[]): EnrichmentFieldOutcome[] {
  const byField = new Map(fields.map((f) => [f.field, f]));
  return OUTCOME_FIELDS.map((field) => {
    const found = byField.get(field);
    return {
      field,
      status: "complete" as const,
      has: found != null,
      value: found?.value ?? null,
      confidence: found?.confidence ?? null,
    };
  });
}

/**
 * Resultado de um pass de scrape.
 *
 * `taxIdCandidates` fica FORA de `fields`/`outcomes` de propósito: aquela
 * máquina de estados é dos campos de contato (email/instagram/whatsapp) e
 * alimenta `enrichment_fields`/`enrichment_state`. CNPJ não é campo de
 * contato — é pista de identidade, com fonte e TTL próprios
 * (enrichment_sources.business_registry). Misturar os dois corromperia o
 * estado de enriquecimento de contato.
 */
export interface WebsiteEnrichment {
  fields: EnrichedField[];
  status: EnrichmentStatus;
  outcomes: EnrichmentFieldOutcome[];
  /** CNPJs plausíveis achados no HTML já baixado — custo zero. */
  taxIdCandidates: string[];
}

export async function enrichFromWebsite(input: {
  website?: string | null;
  timeoutMs?: number;
}): Promise<WebsiteEnrichment> {
  const domain = normalizeDomain(input.website);
  if (!input.website || !domain)
    return { fields: [], status: "not_found", outcomes: [], taxIdCandidates: [] };

  // The "website" IS the Instagram profile — pull the handle from the URL
  // itself rather than fetching (Instagram blocks unauthenticated scraping).
  const directInstagram = instagramHandleFromUrl(input.website);
  if (directInstagram) {
    const fields: EnrichedField[] = [
      {
        field: "instagram",
        value: directInstagram,
        confidence: 0.9,
        verification: "unverified",
        sourceUrl: input.website,
        provider: PROVIDER,
      },
    ];
    return {
      fields,
      status: "ok",
      outcomes: [
        {
          field: "instagram",
          status: "complete",
          has: true,
          value: directInstagram,
          confidence: 0.9,
        },
      ],
      // Perfil do Instagram não é o site da empresa — não há HTML institucional
      // onde procurar CNPJ.
      taxIdCandidates: [],
    };
  }

  let safeUrl: URL;
  try {
    safeUrl = await assertSafeUrlResolved(
      input.website.startsWith("http") ? input.website : `https://${domain}`,
    );
  } catch (err) {
    if (err instanceof SsrfBlockedError)
      return { fields: [], status: "blocked", outcomes: [], taxIdCandidates: [] };
    return { fields: [], status: "not_found", outcomes: [], taxIdCandidates: [] };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 15000);
  try {
    const res = await safeFetch(safeUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "leads-platform-enricher/1.0", Accept: "text/html" },
    });
    // 4xx = page absent/unreachable → definitively nothing to extract.
    // 5xx = transient provider error → surface as "error" so the caller retries.
    if (!res.ok) {
      const status: EnrichmentStatus = res.status >= 500 ? "error" : "not_found";
      return { fields: [], status, outcomes: [], taxIdCandidates: [] };
    }
    const html = (await res.text()).slice(0, 500_000); // bound payload
    const fields = extract(html, safeUrl.toString());
    return {
      fields,
      // O status continua refletindo só os campos de CONTATO: um site que só
      // publica o CNPJ não passa a ser "ok" para contato.
      status: fields.length ? "ok" : "not_found",
      outcomes: outcomesFromFound(fields),
      taxIdCandidates: extractCnpjCandidates(html),
    };
  } catch (err) {
    if (err instanceof SsrfBlockedError)
      return { fields: [], status: "blocked", outcomes: [], taxIdCandidates: [] };
    // Timeout / DNS / connection reset → transient; retryable.
    return { fields: [], status: "error", outcomes: [], taxIdCandidates: [] };
  } finally {
    clearTimeout(timer);
  }
}
