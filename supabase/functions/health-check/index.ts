// Health check endpoint — verifica dependências críticas.
// GET /health-check → 200 se tudo ok, 503 se dependência falhou.
// Separado em /health (processo vivo) e /ready (banco + dependências).

import { handleOptions, corsHeaders } from "../_shared/http.ts";
import { adminClient } from "../_shared/auth.ts";

interface HealthStatus {
  status: "ok" | "degraded" | "down";
  uptime: number;
  checks: Record<string, { status: "ok" | "fail"; latencyMs?: number; error?: string }>;
}

const startTime = Date.now();

Deno.serve(async (req: Request) => {
  const opts = handleOptions(req);
  if (opts) return opts;

  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");

  if (path === "/health-check" || path === "/health") {
    return health();
  }
  if (path === "/health-check/ready" || path === "/ready") {
    return ready();
  }

  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

/** Processo vivo — sempre 200 se o servidor responde. */
function health(): Response {
  const status: HealthStatus = {
    status: "ok",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks: {
      process: { status: "ok" },
    },
  };
  return new Response(JSON.stringify(status), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Dependências — verifica banco (se aplicável). */
async function ready(): Promise<Response> {
  const checks: HealthStatus["checks"] = {};

  // Database check
  try {
    const start = Date.now();
    const admin = adminClient();
    const { data, error } = await admin.from("organizations").select("id").limit(1);
    if (error) throw error;
    checks.database = { status: "ok", latencyMs: Date.now() - start };
  } catch (err) {
    checks.database = {
      status: "fail",
      error: err instanceof Error ? err.message : "Database unavailable",
    };
  }

  const hasFailure = Object.values(checks).some((c) => c.status === "fail");
  const status: HealthStatus = {
    status: hasFailure ? "degraded" : "ok",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks,
  };

  return new Response(JSON.stringify(status), {
    status: hasFailure ? 503 : 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
