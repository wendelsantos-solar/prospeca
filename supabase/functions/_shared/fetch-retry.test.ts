import { expect, test, afterEach } from "bun:test";
import { fetchWithRetry, isRetryableStatus } from "./fetch-retry.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Substitui o fetch global por uma sequência scriptada e conta as chamadas. */
function scriptFetch(steps: Array<Response | (() => never) | Error>) {
  const calls: string[] = [];
  globalThis.fetch = ((input: string | URL) => {
    const step = steps[Math.min(calls.length, steps.length - 1)];
    calls.push(String(input));
    if (step instanceof Error) return Promise.reject(step);
    if (typeof step === "function") return Promise.reject(new Error("network down"));
    return Promise.resolve(step.clone());
  }) as typeof fetch;
  return calls;
}

const ok = () => new Response("{}", { status: 200 });
const status = (s: number, headers?: Record<string, string>) =>
  new Response("{}", { status: s, headers });

test("isRetryableStatus: 429/408/5xx sim, 400/404 nao", () => {
  expect(isRetryableStatus(429)).toBe(true);
  expect(isRetryableStatus(408)).toBe(true);
  expect(isRetryableStatus(500)).toBe(true);
  expect(isRetryableStatus(503)).toBe(true);
  expect(isRetryableStatus(400)).toBe(false);
  expect(isRetryableStatus(404)).toBe(false);
  expect(isRetryableStatus(200)).toBe(false);
});

test("404 nao re-tenta — resposta definitiva do provedor", async () => {
  const calls = scriptFetch([status(404)]);
  const res = await fetchWithRetry("https://x.test/a", undefined, { baseDelayMs: 1 });
  expect(res.status).toBe(404);
  expect(calls.length).toBe(1);
});

test("400 nao re-tenta", async () => {
  const calls = scriptFetch([status(400)]);
  const res = await fetchWithRetry("https://x.test/a", undefined, { baseDelayMs: 1 });
  expect(res.status).toBe(400);
  expect(calls.length).toBe(1);
});

test("429 re-tenta e devolve o sucesso seguinte", async () => {
  const calls = scriptFetch([status(429), ok()]);
  const res = await fetchWithRetry("https://x.test/a", undefined, { baseDelayMs: 1 });
  expect(res.status).toBe(200);
  expect(calls.length).toBe(2);
});

test("5xx re-tenta ate o limite e devolve o ultimo status", async () => {
  const calls = scriptFetch([status(503)]);
  const res = await fetchWithRetry("https://x.test/a", undefined, {
    attempts: 3,
    baseDelayMs: 1,
  });
  expect(res.status).toBe(503);
  expect(calls.length).toBe(3);
});

test("erro de rede re-tenta e, esgotado, lanca via onExhausted", async () => {
  const calls = scriptFetch([new Error("ECONNRESET")]);
  const attempt = fetchWithRetry("https://x.test/a", undefined, {
    attempts: 2,
    baseDelayMs: 1,
    onExhausted: () => new Error("provider unavailable"),
  });
  expect(attempt).rejects.toThrow("provider unavailable");
  await attempt.catch(() => {});
  expect(calls.length).toBe(2);
});

test("Retry-After é respeitado e limitado por maxRetryAfterMs", async () => {
  const calls = scriptFetch([status(429, { "retry-after": "300" }), ok()]);
  const started = Date.now();
  const res = await fetchWithRetry("https://x.test/a", undefined, {
    baseDelayMs: 1,
    maxRetryAfterMs: 20,
  });
  const elapsed = Date.now() - started;
  expect(res.status).toBe(200);
  expect(calls.length).toBe(2);
  // Sem o teto, o Retry-After de 300s prenderia a edge function.
  expect(elapsed).toBeLessThan(2000);
});

test("timeout por tentativa aborta e re-tenta", async () => {
  let n = 0;
  globalThis.fetch = ((_input: string | URL, init?: RequestInit) => {
    n++;
    if (n === 1) {
      // Nunca resolve: só o abort do timeout encerra esta tentativa.
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    }
    return Promise.resolve(ok());
  }) as typeof fetch;

  const res = await fetchWithRetry("https://x.test/a", undefined, {
    attempts: 2,
    baseDelayMs: 1,
    timeoutMs: 15,
  });
  expect(res.status).toBe(200);
  expect(n).toBe(2);
});

test("abort do CHAMADOR propaga sem re-tentar", async () => {
  const controller = new AbortController();
  let n = 0;
  globalThis.fetch = ((_input: string | URL, init?: RequestInit) => {
    n++;
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    });
  }) as typeof fetch;

  const attempt = fetchWithRetry(
    "https://x.test/a",
    { signal: controller.signal },
    {
      attempts: 3,
      baseDelayMs: 1,
      timeoutMs: 500,
    },
  );
  controller.abort();
  await attempt.catch(() => {});
  expect(n).toBe(1);
});
