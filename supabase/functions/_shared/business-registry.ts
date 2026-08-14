// Business Registry adapter — resolves CNPJ registration data from a public
// registry. The real implementation hits BrasilAPI (free, no auth); a Noop is
// provided so the lookup path can run disabled/offline without fabricating
// data. Mirrors the enrich.ts split: HTTP lives here, pure rules in
// @leads/domain/business-registry.
import {
  isValidCnpj,
  normalizeCnpj,
  registrationStatusFromSituacao,
  type BusinessRegistration,
  type BusinessRegistryProvider,
} from "@leads/domain/business-registry";

const BRASIL_API_BASE = "https://brasilapi.com.br/api/cnpj/v1";

interface BrasilApiCnpjResponse {
  razao_social?: string;
  nome_fantasia?: string | null;
  cnae_fiscal?: number;
  cnae_fiscal_descricao?: string;
  cnaes_secundarios?: Array<{ codigo?: number; descricao?: string } | number | string>;
  situacao_cadastral?: string;
  descricao_situacao_cadastral?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  ddd_telefone_1?: string;
  email?: string;
  data_inicio_atividade?: string;
}

export class BrasilApiBusinessRegistry implements BusinessRegistryProvider {
  constructor(private baseUrl: string = BRASIL_API_BASE) {}

  async lookupByCnpj(cnpj: string): Promise<BusinessRegistration | null> {
    const taxId = normalizeCnpj(cnpj);
    if (!isValidCnpj(taxId)) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(`${this.baseUrl}/${taxId}`, {
        signal: controller.signal,
        headers: { "User-Agent": "leads-platform-registry/1.0", Accept: "application/json" },
      });
      if (res.status === 404) return null; // unknown CNPJ
      if (!res.ok) throw new Error(`business registry ${res.status}`);
      const raw = (await res.json()) as BrasilApiCnpjResponse;

      return {
        taxId,
        legalName: raw.razao_social ?? null,
        tradeName: raw.nome_fantasia ?? null,
        primaryCnae: raw.cnae_fiscal != null ? String(raw.cnae_fiscal) : null,
        cnaeDescription: raw.cnae_fiscal_descricao ?? null,
        secondaryCnaes: (raw.cnaes_secundarios ?? [])
          .map((c) => (typeof c === "object" ? String(c.codigo ?? "") : String(c)))
          .filter(Boolean),
        status: registrationStatusFromSituacao(raw.situacao_cadastral),
        statusDescription:
          raw.descricao_situacao_cadastral ?? raw.situacao_cadastral ?? null,
        city: raw.municipio ?? null,
        state: raw.uf ?? null,
        postalCode: raw.cep ?? null,
        // BrasilAPI only exposes the DDD (full phone is a paid endpoint); keep
        // it for a future phone-enrichment pass, never treat it as a full number.
        phone: raw.ddd_telefone_1 ?? null,
        email: raw.email ?? null,
        foundedAt: raw.data_inicio_atividade ?? null,
        fetchedAt: new Date().toISOString(),
      };
    } finally {
      clearTimeout(timer);
    }
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
