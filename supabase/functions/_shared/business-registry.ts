// Business Registry adapter — resolves CNPJ registration data from a public
// registry. The real implementation hits BrasilAPI (free, no auth); a Noop is
// provided so the lookup path can run disabled/offline without fabricating
// data. Mirrors the enrich.ts split: HTTP lives here, pure rules in
// @leads/domain/business-registry.
//
// Este arquivo é DELIBERADAMENTE fino: rede (retry/timeout) e nada mais. O
// shape cru da BrasilAPI e sua tradução vivem no domínio (mapBrasilApiCnpj),
// onde são cobertos por teste — o mapeamento do QSA já quebrou uma vez em
// silêncio justamente por morar aqui, fora do alcance dos testes.
import {
  isValidCnpj,
  mapBrasilApiCnpj,
  normalizeCnpj,
  type BrasilApiCnpjPayload,
  type BusinessRegistration,
  type BusinessRegistryProvider,
} from "@leads/domain/business-registry";
import { fetchWithRetry } from "./fetch-retry.ts";

const BRASIL_API_BASE = "https://brasilapi.com.br/api/cnpj/v1";
/** Timeout por tentativa. A BrasilAPI é gratuita e sem SLA — curto de propósito. */
const REGISTRY_TIMEOUT_MS = 8000;
const REGISTRY_RETRY_ATTEMPTS = 3;

export class BrasilApiBusinessRegistry implements BusinessRegistryProvider {
  constructor(private baseUrl: string = BRASIL_API_BASE) {}

  async lookupByCnpj(cnpj: string): Promise<BusinessRegistration | null> {
    const taxId = normalizeCnpj(cnpj);
    if (!isValidCnpj(taxId)) return null;

    // Resiliência (brief §17): retry só em transitório (429/408/5xx/timeout/
    // rede), nunca em 400/404. Backoff exponencial respeitando Retry-After —
    // mecanismo COMPARTILHADO (_shared/fetch-retry.ts), não um segundo retry.
    const res = await fetchWithRetry(
      `${this.baseUrl}/${taxId}`,
      { headers: { "User-Agent": "leads-platform-registry/1.0", Accept: "application/json" } },
      {
        attempts: REGISTRY_RETRY_ATTEMPTS,
        timeoutMs: REGISTRY_TIMEOUT_MS,
        onExhausted: () => new Error("business registry unavailable"),
      },
    );
    if (res.status === 404) return null; // unknown CNPJ
    if (!res.ok) throw new Error(`business registry ${res.status}`);
    const raw = (await res.json()) as BrasilApiCnpjPayload;

    return mapBrasilApiCnpj(taxId, raw, new Date().toISOString());
  }
}

/** Noop — used when the registry provider is disabled. Returns null ("não
 * consultei"), never fabricates a record. */
export class NoopBusinessRegistry implements BusinessRegistryProvider {
  lookupByCnpj(_cnpj: string): Promise<BusinessRegistration | null> {
    return Promise.resolve(null);
  }
}

export function businessRegistryProvider(): BusinessRegistryProvider {
  const disabled = Deno.env.get("BUSINESS_REGISTRY_DISABLED") === "true";
  return disabled ? new NoopBusinessRegistry() : new BrasilApiBusinessRegistry();
}

/** True when the registry provider is disabled — the lookup answers
 * {found:false, reason:'provider_disabled'} honestly instead of fabricating. */
export function isBusinessRegistryDisabled(): boolean {
  return Deno.env.get("BUSINESS_REGISTRY_DISABLED") === "true";
}
