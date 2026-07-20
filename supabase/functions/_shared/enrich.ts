// Website enricher — extracts contact signals from a lead's OWN website only.
// No search-engine scraping, no third-party crawling. SSRF-guarded, timed out,
// single page. Returns explicit not_found signals rather than fabricating data.
import { assertSafeUrl, SsrfBlockedError } from "./ssrf.ts";
import { normalizeDomain } from "./normalize.ts";

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
    out.push({ field, value, confidence, verification: "unverified", sourceUrl: pageUrl, provider: PROVIDER });

  const email = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0];
  if (email && !/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(email)) push("email", email.toLowerCase(), 0.6);

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

  let safeUrl: URL;
  try {
    safeUrl = assertSafeUrl(input.website.startsWith("http") ? input.website : `https://${domain}`);
  } catch (err) {
    if (err instanceof SsrfBlockedError) return { fields: [], status: "blocked" };
    return { fields: [], status: "not_found" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 15000);
  try {
    const res = await fetch(safeUrl.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "leads-platform-enricher/1.0", Accept: "text/html" },
    });
    if (!res.ok) return { fields: [], status: "not_found" };
    const html = (await res.text()).slice(0, 500_000); // bound payload
    const fields = extract(html, safeUrl.toString());
    return { fields, status: fields.length ? "ok" : "not_found" };
  } catch {
    return { fields: [], status: "not_found" };
  } finally {
    clearTimeout(timer);
  }
}
