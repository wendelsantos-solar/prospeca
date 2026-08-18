import { useState } from "react";
import { BadgeCheck, FileSearch, Landmark, Loader2, RefreshCw } from "lucide-react";
import { isValidCnpj, normalizeCnpj } from "@leads/domain";
import {
  useBusinessRegistration,
  useCnpjLookupMutation,
  useCnpjOrigin,
} from "@/hooks/useLeadsQuery";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CompanyPeopleSection } from "./CompanyPeopleSection";

/** Espelha ENRICHMENT_SOURCE_TTL_DAYS.business_registry (servidor). */
const REGISTRY_TTL_DAYS = 90;

const REGISTRY_STATUS_LABELS: Record<string, string> = {
  active: "Ativa",
  suspended: "Suspensa",
  inactive: "Inativa",
  unknown: "Situação não informada",
};

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-2 py-1">
      <span className="shrink-0 text-[12px] text-muted-foreground">{label}</span>
      <span className="text-right text-[12.5px] font-medium text-foreground">{value ?? "—"}</span>
    </div>
  );
}

/**
 * Cadastro público (CNPJ) — Fase 5, gated by cnaeIntelligenceEnabled.
 *
 * Resiliência (requisitos do usuário): a fonte BrasilAPI é ADITIVA — nunca
 * bloqueia o discovery nem falha a empresa. Estados honestos:
 *   - dado persistido → exibe razão social / CNPJ / CNAE / situação;
 *   - {found:false} → "sem cadastro encontrado" é resposta NORMAL;
 *   - fonte indisponível/desabilitada → mensagem local, sem erro global.
 * O cache/TTL (90d) vive no servidor (enrichment_sources.business_registry) —
 * abrir o drawer não re-consulta a fonte.
 */
export function BusinessRegistrySection({ placeId }: { placeId: string }) {
  const { data: registration, isLoading } = useBusinessRegistration(placeId);
  const lookup = useCnpjLookupMutation(placeId);
  const { data: cnpjOrigin } = useCnpjOrigin(placeId);
  const [cnpj, setCnpj] = useState("");

  const normalized = normalizeCnpj(cnpj);
  const inputTouched = cnpj.trim().length > 0;
  const valid = isValidCnpj(normalized);
  const hasRegistration = Boolean(
    registration?.tax_id ||
    registration?.legal_name ||
    registration?.primary_cnae ||
    registration?.registration_status ||
    registration?.company_size ||
    registration?.founded_at ||
    registration?.is_mei,
  );

  // V3-D: age only from a REAL registry date — never invented.
  const ageYears = registration?.founded_at
    ? Math.floor((Date.now() - new Date(registration.founded_at).getTime()) / (365.25 * 86400000))
    : null;

  const result = lookup.data;

  /**
   * Frescor honesto: o TTL do registro é de 90 dias (servidor —
   * ENRICHMENT_SOURCE_TTL_DAYS.business_registry). Antes disso "Atualizar"
   * gastaria consulta para reescrever o mesmo dado, então o botão existe mas o
   * texto diz que já está atualizado.
   */
  const fetchedAt = registration?.registration_fetched_at
    ? new Date(registration.registration_fetched_at)
    : null;
  const ageDays = fetchedAt ? (Date.now() - fetchedAt.getTime()) / 86400000 : null;
  const isStale = ageDays != null && ageDays >= REGISTRY_TTL_DAYS;
  const registryFreshness = isStale ? "Desatualizado" : "Atualizado";

  return (
    <div className="mt-4 rounded-lg border border-border bg-surface/50 p-3">
      <div className="flex items-center gap-1.5">
        <Landmark className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">
          Cadastro público (CNPJ)
        </p>
      </div>

      {isLoading && (
        <div className="mt-2 flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Carregando cadastro…
        </div>
      )}

      {!isLoading && hasRegistration && (
        <div className="mt-2 divide-y divide-border/60">
          {registration?.legal_name && <Row label="Razão social" value={registration.legal_name} />}
          {registration?.tax_id && <Row label="CNPJ" value={registration.tax_id} />}
          {/* Proveniência do CNPJ: descoberto no site ≠ informado pelo usuário.
           * Rodapé brasileiro às vezes traz o CNPJ da agência que fez o site,
           * então a origem fica visível — e mais visível ainda quando o site
           * listava mais de um número. */}
          {cnpjOrigin && cnpjOrigin.provider_external_id === registration?.tax_id && (
            <p className="py-1 text-[11px] text-muted-foreground">
              {cnpjOrigin.metadata?.ambiguous
                ? "CNPJ localizado no site da empresa, que listava mais de um número — confira antes de usar."
                : "CNPJ localizado automaticamente no site da empresa."}
            </p>
          )}
          {registration?.primary_cnae && (
            <Row
              label="CNAE"
              value={[registration.primary_cnae, registration.cnae_description]
                .filter(Boolean)
                .join(" — ")}
            />
          )}
          {registration?.registration_status && (
            <Row
              label="Situação"
              value={
                REGISTRY_STATUS_LABELS[registration.registration_status] ??
                registration.registration_status_description ??
                registration.registration_status
              }
            />
          )}
          {registration?.secondary_cnaes && registration.secondary_cnaes.length > 0 && (
            <Row label="CNAEs secundários" value={registration.secondary_cnaes.join(", ")} />
          )}
          {registration?.company_size && (
            <Row
              label="Porte"
              value={registration.company_size + (registration.is_mei ? " · MEI" : "")}
            />
          )}
          {registration?.legal_nature && (
            <Row label="Natureza jurídica" value={registration.legal_nature} />
          )}
          {registration?.capital_social != null && (
            <Row label="Capital social" value={formatBRL(registration.capital_social)} />
          )}
          {registration?.founded_at && (
            <Row
              label="Abertura"
              value={`${new Date(registration.founded_at).toLocaleDateString("pt-BR")}${
                ageYears != null && ageYears >= 0 ? ` (${ageYears} anos)` : ""
              }`}
            />
          )}
          {registration?.simples_nacional != null && (
            <Row
              label="Simples Nacional"
              value={
                registration.simples_nacional
                  ? `Optante${
                      registration.simples_opted_at
                        ? ` desde ${new Date(registration.simples_opted_at).toLocaleDateString("pt-BR")}`
                        : ""
                    }`
                  : "Não optante"
              }
            />
          )}
          {registration?.is_mei != null && !registration.company_size && (
            <Row label="MEI" value={registration.is_mei ? "Sim" : "Não"} />
          )}
          {registration?.establishment_type && registration.establishment_type !== "unknown" && (
            <Row
              label="Estabelecimento"
              value={registration.establishment_type === "headquarters" ? "Matriz" : "Filial"}
            />
          )}
          {registration?.registry_street_address && (
            <Row label="Logradouro (registro)" value={registration.registry_street_address} />
          )}
          {registration?.registry_district && (
            <Row label="Bairro (registro)" value={registration.registry_district} />
          )}
          {registration?.registry_city && (
            <Row
              label="Endereço (registro)"
              value={[registration.registry_city, registration.registry_state]
                .filter(Boolean)
                .join(" - ")}
            />
          )}
          {registration?.registry_postal_code && (
            <Row label="CEP (registro)" value={registration.registry_postal_code} />
          )}
          {registration?.registry_email && (
            <Row label="E-mail (registro)" value={registration.registry_email} />
          )}
          {registration?.registry_phone && (
            <Row label="Telefone (registro)" value={registration.registry_phone} />
          )}
          {registration?.registration_fetched_at && (
            <>
              <Row
                label="Última atualização"
                value={new Date(registration.registration_fetched_at).toLocaleString("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              />
              <Row label="Fonte" value="BrasilAPI · cadastro público" />
              <Row label="Status" value={registryFreshness} />
            </>
          )}
        </div>
      )}

      <CompanyPeopleSection
        placeId={placeId}
        hasBeenLookedUp={registration?.registration_fetched_at != null}
        isLoadingRegistration={isLoading}
      />

      {/* Atualizar — reconsulta o MESMO CNPJ já vinculado, sem o usuário
       * redigitar. Só aparece quando existe CNPJ persistido. */}
      {registration?.tax_id && (
        <button
          onClick={() => lookup.mutate(registration.tax_id!)}
          disabled={lookup.isPending}
          className="mt-2 inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11.5px] font-medium text-foreground transition-colors hover:bg-surface-hover disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3 w-3", lookup.isPending && "animate-spin")} />
          {lookup.isPending ? "Consultando cadastro…" : "Atualizar dados"}
        </button>
      )}

      {/* Consulta manual — validada no cliente (isValidCnpj) antes de enviar. */}
      <div className="mt-3 flex gap-2">
        <input
          value={cnpj}
          onChange={(e) => setCnpj(e.target.value)}
          placeholder="00.000.000/0000-00"
          aria-label="CNPJ da empresa"
          className={cn(
            "h-8 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-[12px] font-mono text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/15",
            inputTouched && !valid && "border-destructive",
          )}
        />
        <button
          onClick={() => {
            if (!valid) return;
            lookup.mutate(normalized);
          }}
          disabled={!valid || lookup.isPending}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-[12px] font-medium text-foreground transition-colors hover:bg-surface-hover disabled:opacity-50"
        >
          {lookup.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <FileSearch className="h-3 w-3" />
          )}
          Consultar
        </button>
      </div>

      {inputTouched && !valid && (
        <p className="mt-1 text-[11px] text-destructive">CNPJ inválido — confira os dígitos.</p>
      )}

      {/* Respostas honestas da fonte — nunca um erro global da empresa. */}
      {result && !result.found && result.reason === "not_found" && (
        <p className="mt-1.5 text-[11.5px] text-muted-foreground">
          CNPJ válido, sem cadastro encontrado na base pública. Empresa sem cadastro resolvido é
          normal e não afeta os demais dados.
        </p>
      )}
      {result && !result.found && result.reason === "provider_unavailable" && (
        <p className="mt-1.5 text-[11.5px] text-muted-foreground">
          Fonte de cadastro indisponível no momento. Os demais dados da empresa não são afetados —
          tente novamente mais tarde.
        </p>
      )}
      {result && !result.found && result.reason === "provider_disabled" && (
        <p className="mt-1.5 text-[11.5px] text-muted-foreground">
          Consulta de CNPJ desabilitada neste ambiente.
        </p>
      )}
      {result?.found && (
        <p className="mt-1.5 flex items-center gap-1 text-[11.5px] font-medium text-primary">
          <BadgeCheck className="h-3.5 w-3.5" />
          Cadastro encontrado e vinculado à empresa.
        </p>
      )}
      {lookup.isError && !result && (
        <p className="mt-1.5 text-[11.5px] text-muted-foreground">
          Não foi possível consultar agora — a empresa continua utilizável normalmente.
        </p>
      )}
    </div>
  );
}
