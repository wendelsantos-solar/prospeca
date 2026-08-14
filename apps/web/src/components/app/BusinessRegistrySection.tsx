import { useState } from "react";
import { BadgeCheck, FileSearch, Landmark, Loader2 } from "lucide-react";
import { isValidCnpj, normalizeCnpj } from "@leads/domain";
import { useBusinessRegistration, useCnpjLookupMutation } from "@/hooks/useLeadsQuery";
import { cn } from "@/lib/utils";

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
  const [cnpj, setCnpj] = useState("");

  const normalized = normalizeCnpj(cnpj);
  const inputTouched = cnpj.trim().length > 0;
  const valid = isValidCnpj(normalized);
  const hasRegistration = Boolean(
    registration?.tax_id ||
    registration?.legal_name ||
    registration?.primary_cnae ||
    registration?.registration_status,
  );

  const result = lookup.data;

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
          {registration?.registration_fetched_at && (
            <Row
              label="Consultado em"
              value={new Date(registration.registration_fetched_at).toLocaleDateString("pt-BR")}
            />
          )}
        </div>
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
