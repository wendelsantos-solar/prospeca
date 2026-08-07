// Website enricher — extracts contact signals from a lead's OWN website only.
// No search-engine scraping, no third-party crawling. SSRF-guarded, timed out,
// single page. Returns explicit not_found signals rather than fabricating data.
import { assertSafeUrl, isPrivateIpv4, isPrivateIpv6, SsrfBlockedError } from "@leads/domain/ssrf";
import { instagramHandleFromUrl, normalizeDomain } from "@leads/domain/normalize";

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

export async function enrichFromWebsite(input: {
  website?: string | null;
  timeoutMs?: number;
}): Promise<{ fields: EnrichedField[]; status: "ok" | "not_found" | "blocked" }> {
  const domain = normalizeDomain(input.website);
  if (!input.website || !domain) return { fields: [], status: "not_found" };

  // The "website" IS the Instagram profile — pull the handle from the URL
  // itself rather than fetching (Instagram blocks unauthenticated scraping).
  const directInstagram = instagramHandleFromUrl(input.website);
  if (directInstagram) {
    return {
      fields: [
        {
          field: "instagram",
          value: directInstagram,
          confidence: 0.9,
          verification: "unverified",
          sourceUrl: input.website,
          provider: PROVIDER,
        },
      ],
      status: "ok",
    };
  }

  let safeUrl: URL;
  try {
    safeUrl = await assertSafeUrlResolved(
      input.website.startsWith("http") ? input.website : `https://${domain}`,
    );
  } catch (err) {
    if (err instanceof SsrfBlockedError) return { fields: [], status: "blocked" };
    return { fields: [], status: "not_found" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 15000);
  try {
    const res = await safeFetch(safeUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "leads-platform-enricher/1.0", Accept: "text/html" },
    });
    if (!res.ok) return { fields: [], status: "not_found" };
    const html = (await res.text()).slice(0, 500_000); // bound payload
    const fields = extract(html, safeUrl.toString());
    return { fields, status: fields.length ? "ok" : "not_found" };
  } catch (err) {
    if (err instanceof SsrfBlockedError) return { fields: [], status: "blocked" };
    return { fields: [], status: "not_found" };
  } finally {
    clearTimeout(timer);
  }
}
