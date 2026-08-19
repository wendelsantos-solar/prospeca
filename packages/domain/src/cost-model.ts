// Cost model — tabela de preço por provider/operação em UM lugar só, com
// versão (o custo muda e precisa ser auditável no tempo). Fase 7 —
// cost observability.
//
// REGRA DURA da fase: NUNCA registrar 0 como "sem custo" quando o valor é
// DESCONHECIDO. NULL = desconhecido; 0 = comprovadamente zero (infra própria,
// API gratuita, cache hit). A distinção é o ponto inteiro desta fase.
//
// As taxas do Google espelham as constantes já existentes em
// org_mtd_api_cost_usd (20260724000004) — mesmos números, nenhum duplicado
// "mágico" novo (place_search_request 0.035, place_details_request 0.020,
// geocode_request 0.005 — SKUs Places API New).
//
// FONTE ÚNICA (P2-3 da Fase 7b): o código NOVO lê ESTA tabela. O SQL antigo
// agora também lê a fonte única via public.provider_cost (migration
// 20260815000015), e org_mtd_api_cost_usd foi REDEFINIDA lá para consultar a
// tabela. O teste estático rpc-authorization.test.ts falha se os números
// daqui divergirem dos seeds da migration.
//
// CÓPIAS HISTÓRICAS NÃO TOCADAS (migrations antigas não se editam — sincronizar
// quando uma fase futura as reescrever):
//   - 20260724000002_fix_admin_membership_table.sql:42-46,66 (tabela de custo
//     embutida em get_admin_overview);
//   - 20260724000005_platform_admin.sql:57-58 (0.035/0.020 em custo de
//     tarefas admin).
//   Qualquer mudança de preço futura deve: (1) bump COST_TABLE_VERSION,
//   (2) atualizar ESTA tabela, (3) atualizar os seeds de public.provider_cost
//   via migration NOVA — linha NOVA com valid_from = data da mudança e a
//   linha anterior com valid_to (vigência temporal, Fase 7c: o histórico de
//   custo NÃO é recalculado com preço novo), (4) revisar as cópias históricas
//   acima.

export const COST_TABLE_VERSION = 1;

export type CostSource = "measured" | "estimated";

export interface CostTableEntry {
  provider: string;
  operation: string;
  /**
   * Preço de lista por UNIDADE (USD).
   * number  = taxa conhecida (estima-se; fonte 'estimated' quando usado);
   * 0       = comprovadamente gratuito (infra própria / API gratuita);
   * null    = DESCONHECIDO — jamais tratar como zero.
   */
  inputCostUsd: number | null;
  outputCostUsd: number | null;
  credits: number | null;
  notes: string;
}

export const COST_TABLE: readonly CostTableEntry[] = [
  {
    provider: "google_places",
    operation: "place_search_request",
    inputCostUsd: 0.035,
    outputCostUsd: null,
    credits: null,
    notes:
      "Text Search Enterprise por página (SKU Places API New) — mesma taxa de org_mtd_api_cost_usd.",
  },
  {
    provider: "google_places",
    operation: "place_search_refresh",
    inputCostUsd: 0.035,
    outputCostUsd: null,
    credits: null,
    notes: "Refresh forçado = mesma chamada Text Search paga (mesmo SKU de place_search_request).",
  },
  {
    provider: "google_places",
    operation: "place_details_request",
    inputCostUsd: 0.02,
    outputCostUsd: null,
    credits: null,
    notes: "Place Details Enterprise — mesma taxa de org_mtd_api_cost_usd.",
  },
  {
    provider: "google_geocoding",
    operation: "geocode_request",
    inputCostUsd: 0.005,
    outputCostUsd: null,
    credits: null,
    notes: "Geocoding — mesma taxa de org_mtd_api_cost_usd.",
  },
  {
    provider: "website_scraper",
    operation: "enrich_request",
    inputCostUsd: 0,
    outputCostUsd: null,
    credits: null,
    notes:
      "Scrape do site da PRÓPRIA empresa (infra própria, SSRF-guardada) — sem fee por chamada. Zero COMPROVADO, não desconhecido.",
  },
  {
    provider: "brasil_api",
    operation: "cnpj_lookup",
    inputCostUsd: 0,
    outputCostUsd: null,
    credits: null,
    notes: "BrasilAPI é gratuita — zero COMPROVADO, não desconhecido.",
  },
  {
    provider: "anthropic",
    operation: "ai_message_generate",
    inputCostUsd: null,
    outputCostUsd: null,
    credits: null,
    notes:
      "Custo por TOKEN — sem medição de tokens hoje: DESCONHECIDO (NULL). Registrar 0 aqui mentiria.",
  },
] as const;

export function costEntryFor(provider: string, operation: string): CostTableEntry | undefined {
  return COST_TABLE.find((e) => e.provider === provider && e.operation === operation);
}

export interface UsageCost {
  /** Custo REAL reportado pelo provider (hoje: raramente disponível). */
  realCostUsd: number | null;
  /** Custo ESTIMADO pela tabela de preço (null = desconhecido). */
  estimatedCostUsd: number | null;
  /** 'measured' (real/cache/free) vs 'estimated' (tabela) vs null (desconhecido). */
  source: CostSource | null;
  cacheHit: boolean | null;
}

/**
 * Calcula o custo de um lote de chamadas de provider. Regras:
 *   - cache hit → real 0 E estimated 0, source 'measured' (zero comprovado);
 *   - tabela com taxa 0 → real 0, estimated 0, source 'measured' (gratuito);
 *   - tabela com taxa > 0 → estimated = taxa × quantidade, source 'estimated',
 *     real = custo real reportado (se houver) ou null;
 *   - operação desconhecida OU taxa null → TUDO null (desconhecido — nunca 0).
 */
export function calculateUsageCost(
  provider: string,
  operation: string,
  quantity: number,
  opts: { cacheHit?: boolean | null; realCostUsd?: number | null } = {},
): UsageCost {
  const entry = costEntryFor(provider, operation);
  const cacheHit = opts.cacheHit ?? null;

  if (cacheHit === true) {
    return { realCostUsd: 0, estimatedCostUsd: 0, source: "measured", cacheHit: true };
  }

  if (!entry || entry.inputCostUsd === null) {
    return {
      realCostUsd: opts.realCostUsd ?? null,
      estimatedCostUsd: null,
      source: opts.realCostUsd != null ? "measured" : null,
      cacheHit: false,
    };
  }

  const estimatedCostUsd = roundUsd(entry.inputCostUsd * Math.max(0, quantity));
  if (entry.inputCostUsd === 0) {
    return { realCostUsd: 0, estimatedCostUsd: 0, source: "measured", cacheHit: false };
  }
  return {
    realCostUsd: opts.realCostUsd ?? null,
    estimatedCostUsd,
    source: opts.realCostUsd != null ? "measured" : "estimated",
    cacheHit: false,
  };
}

function roundUsd(v: number): number {
  return Math.round(v * 1_000_000) / 1_000_000;
}
