// fetch com retry para blips transitórios de provedores externos.
//
// Extraído de google.ts (onde era privado) para ser a ÚNICA implementação de
// retry HTTP das edge functions — o brief de Company Intelligence (§17) exige
// retry no registry de CNPJ, e criar um segundo mecanismo seria duplicação.
//
// Regras (brief §17):
//   - RETRY em 429 / 408 / 5xx / erro de rede / timeout;
//   - NUNCA em 400 / 404 — resposta definitiva do provedor, devolvida ao chamador;
//   - backoff exponencial, respeitando `Retry-After` quando presente.
//
// Sem imports e sem APIs do Deno de propósito: o módulo é puro sobre `fetch`,
// então roda igual sob `bun test` e sob o runtime das edge functions. Quem
// precisa de um erro tipado (AppError) passa `onExhausted`.

export interface FetchRetryOptions {
  /** Total de tentativas (1 = sem retry). Default 3. */
  attempts?: number;
  /** Base do backoff exponencial em ms (attempt N espera base * 2^N). Default 400. */
  baseDelayMs?: number;
  /**
   * Timeout POR TENTATIVA em ms. O estouro conta como erro de rede e é
   * re-tentado. `undefined`/0 = sem timeout próprio.
   */
  timeoutMs?: number;
  /**
   * Teto para o `Retry-After` do provedor, em ms. Sem teto, um `Retry-After:
   * 300` prenderia a edge function além do seu próprio limite de execução.
   * Default 5000.
   */
  maxRetryAfterMs?: number;
  /** Erro a lançar quando todas as tentativas falharam por rede/timeout. */
  onExhausted?: (lastError: unknown) => Error;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Status HTTP que merecem nova tentativa. 400/404 são definitivos. */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 408 || status >= 500;
}

export async function fetchWithRetry(
  input: string | URL,
  init?: RequestInit,
  options: FetchRetryOptions = {},
): Promise<Response> {
  const attempts = options.attempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 400;
  const maxRetryAfterMs = options.maxRetryAfterMs ?? 5000;
  const timeoutMs = options.timeoutMs ?? 0;

  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const isLast = attempt === attempts - 1;

    // Timeout próprio por tentativa — um provedor lento não pode consumir o
    // orçamento das tentativas seguintes.
    const controller = timeoutMs > 0 ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    // Um abort do chamador cancela a tentativa em curso e encerra o loop.
    const callerSignal = init?.signal ?? null;
    const onCallerAbort = () => controller?.abort();
    if (controller && callerSignal) callerSignal.addEventListener("abort", onCallerAbort);

    try {
      const res = await fetch(input, controller ? { ...init, signal: controller.signal } : init);
      if (isRetryableStatus(res.status) && !isLast) {
        const retryAfterSeconds = Number(res.headers.get("retry-after"));
        const delay =
          Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
            ? Math.min(retryAfterSeconds * 1000, maxRetryAfterMs)
            : baseDelayMs * 2 ** attempt;
        await sleep(delay);
        continue;
      }
      // Definitivo (2xx/3xx/4xx) ou última tentativa: o chamador decide.
      return res;
    } catch (err) {
      lastError = err;
      // Abort vindo do CHAMADOR não é blip transitório — propaga imediatamente.
      if (callerSignal?.aborted) throw err;
      if (!isLast) {
        await sleep(baseDelayMs * 2 ** attempt);
        continue;
      }
    } finally {
      if (timer) clearTimeout(timer);
      if (controller && callerSignal) callerSignal.removeEventListener("abort", onCallerAbort);
    }
  }

  throw (
    options.onExhausted?.(lastError) ??
    lastError ??
    new Error("fetchWithRetry: todas as tentativas falharam")
  );
}
