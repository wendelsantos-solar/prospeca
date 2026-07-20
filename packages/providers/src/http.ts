// Minimal HTTP helper: injectable fetch (testable), timeout, bounded retries
// with backoff. No secrets logged. Works on Deno, Bun and Node (global fetch).

export type FetchLike = typeof fetch;

export interface HttpOptions {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  maxRetries?: number;
  backoffMs?: number;
  userAgent?: string;
}

export class ProviderHttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderHttpError";
  }
}

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

export async function requestJson<T>(
  input: { url: string; method?: string; body?: string; headers?: Record<string, string> },
  opts: HttpOptions = {},
): Promise<T> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 15000;
  const maxRetries = opts.maxRetries ?? 3;
  const backoffMs = opts.backoffMs ?? 1000;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(input.url, {
        method: input.method ?? "GET",
        body: input.body,
        headers: {
          Accept: "application/json",
          ...(opts.userAgent ? { "User-Agent": opts.userAgent } : {}),
          ...input.headers,
        },
        signal: controller.signal,
      });
      if (!res.ok) {
        if (RETRYABLE.has(res.status) && attempt < maxRetries) {
          lastErr = new ProviderHttpError(`HTTP ${res.status}`, res.status);
        } else {
          throw new ProviderHttpError(`HTTP ${res.status}`, res.status);
        }
      } else {
        return (await res.json()) as T;
      }
    } catch (err) {
      lastErr = err;
      if (err instanceof ProviderHttpError && err.status && !RETRYABLE.has(err.status)) throw err;
      if (attempt >= maxRetries) break;
    } finally {
      clearTimeout(timer);
    }
    // exponential backoff with attempt index (no jitter → deterministic tests)
    await sleep(backoffMs * 2 ** attempt);
  }
  throw lastErr instanceof Error ? lastErr : new ProviderHttpError("request failed");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
