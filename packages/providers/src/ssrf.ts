// SSRF guard. Any outbound request to a user-influenced URL (enrichment,
// website fetches) MUST pass assertSafeUrl first, so the platform can never be
// used as a proxy into private networks or cloud metadata endpoints.

export class SsrfBlockedError extends Error {
  constructor(reason: string) {
    super(`Blocked by SSRF guard: ${reason}`);
    this.name = "SsrfBlockedError";
  }
}

const BLOCKED_HOSTNAMES = new Set(["localhost", "ip6-localhost", "ip6-loopback"]);

/** IPv4 literal in a private / loopback / link-local / metadata range. */
export function isPrivateIpv4(ip: string): boolean {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const o = m.slice(1).map(Number);
  if (o.some((n) => n > 255)) return true; // malformed → treat as unsafe
  const [a, b] = o;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local + metadata
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 0) return true; // 0.0.0.0/8
  return false;
}

/** IPv6 literal that is loopback / unique-local / link-local. */
export function isPrivateIpv6(ip: string): boolean {
  const h = ip.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "::1" || h === "::") return true;
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // fc00::/7 unique-local
  if (h.startsWith("fe8") || h.startsWith("fe9") || h.startsWith("fea") || h.startsWith("feb"))
    return true; // fe80::/10 link-local
  if (h.startsWith("::ffff:")) return isPrivateIpv4(h.slice(7)); // IPv4-mapped
  return false;
}

export function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return true;
  if (isPrivateIpv4(h)) return true;
  if (h.includes(":") && isPrivateIpv6(h)) return true;
  return false;
}

/**
 * Throws SsrfBlockedError unless the URL is a plain http(s) URL to a public host
 * with no embedded credentials. Note: this validates the literal host; when a
 * DNS resolver is available, resolve and re-check the resolved IP too.
 */
export function assertSafeUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfBlockedError("invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SsrfBlockedError(`scheme ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new SsrfBlockedError("embedded credentials");
  }
  if (isBlockedHost(url.hostname)) {
    throw new SsrfBlockedError(`private/internal host ${url.hostname}`);
  }
  return url;
}
