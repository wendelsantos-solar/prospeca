// Shared HTTP helpers: CORS, standardized errors, structured logs.

/** Allowed CORS origins — comma-separated env var or APP_URL. Falls back to * in dev. */
function getAllowedOrigins(): string[] {
  const raw = Deno.env.get("CORS_ORIGINS") ?? Deno.env.get("APP_URL") ?? "*";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Build CORS headers that echo back the request origin when it matches the allow-list. */
export function getCorsHeaders(req?: Request): Record<string, string> {
  const allowed = getAllowedOrigins();
  const origin = req?.headers.get("origin") ?? "";

  let allowOrigin: string;
  if (allowed.includes("*")) {
    allowOrigin = "*";
  } else if (allowed.includes(origin)) {
    allowOrigin = origin;
  } else if (
    origin &&
    (origin.startsWith("http://localhost") ||
      origin.startsWith("http://127.0.0.1") ||
      origin.match(/^https?:\/\/10\.\d+\.\d+\.\d+/))
  ) {
    // Auto-allow common dev origins: localhost / 127.0.0.1 / LAN IPs (10.x.x.x)
    allowOrigin = origin;
  } else {
    allowOrigin = allowed[0] ?? "*";
  }

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-idempotency-key",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };
}

/** Pre-built static cors headers (legacy compat). Prefer getCorsHeaders(req) for dynamic origin. */
export const corsHeaders = getCorsHeaders();

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId: string;
}

export function newRequestId(): string {
  return crypto.randomUUID();
}

export function json(
  body: unknown,
  status = 200,
  extra: HeadersInit = {},
  req?: Request,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json", ...extra },
  });
}

export function apiError(
  requestId: string,
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>,
  req?: Request,
): Response {
  const body: ApiError = { code, message, details, requestId };
  return json(body, status, {}, req);
}

const STATUS_BY_CODE: Record<string, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  VALIDATION_ERROR: 422,
  PLAN_LIMIT_REACHED: 402,
  RATE_LIMIT_EXCEEDED: 429,
  PROVIDER_UNAVAILABLE: 502,
  PROVIDER_QUOTA_EXCEEDED: 429,
  INVALID_LOCATION: 422,
  SEARCH_NOT_FOUND: 404,
  LEAD_NOT_FOUND: 404,
  DUPLICATE_LEAD: 409,
  EXPORT_FAILED: 500,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
  toResponse(requestId: string, req?: Request): Response {
    return apiError(
      requestId,
      this.code,
      this.message,
      STATUS_BY_CODE[this.code] ?? 500,
      this.details,
      req,
    );
  }
}

// Structured log — never log keys, tokens or full payloads.
export function logEvent(fields: Record<string, unknown>): void {
  console.log(JSON.stringify(fields));
}

export function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(req) });
  return null;
}
