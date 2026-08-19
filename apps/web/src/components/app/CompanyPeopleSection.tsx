import { useState } from "react";
import { ChevronDown, ShieldCheck, Users } from "lucide-react";
import { confidenceBandFromConfidence, type ConfidenceBand } from "@leads/domain";
import { useCompanyPeople, type CompanyPersonRow } from "@/hooks/useLeadsQuery";
import { cn } from "@/lib/utils";

/**
 * Decisores — quem provavelmente decide, com o porquê à mão.
 *
 * Regra que rege a tela: nenhuma afirmação importante aparece sem evidência.
 * O score de decisor e a confiança do dado são mostrados SEPARADOS porque
 * respondem perguntas diferentes — "essa pessoa decide?" e "eu confio nesse
 * dado?" (ver packages/domain/src/decision-maker.ts).
 */

const BAND_LABEL: Record<string, string> = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
  unknown: "Indefinida",
};

const BAND_STYLE: Record<string, string> = {
  high: "bg-hot-soft text-hot",
  medium: "bg-warning-soft text-warning-foreground",
  low: "bg-muted text-muted-foreground",
  unknown: "bg-muted text-muted-foreground",
};

const CONFIDENCE_LABEL: Record<ConfidenceBand, string> = {
  high: "alta",
  medium: "média",
  low: "baixa",
};

const SOURCE_LABEL: Record<string, string> = {
  qsa: "QSA (quadro societário)",
};

const PROVIDER_LABEL: Record<string, string> = {
  business_registry: "BrasilAPI · cadastro público",
};

function PersonCard({ person }: { person: CompanyPersonRow }) {
  const [open, setOpen] = useState(false);
  const name = person.people?.full_name ?? "Pessoa não identificada";
  const band = person.role_band ?? "unknown";
  const score = person.decision_score;
  const reasons = person.decision_reasons?.reasons ?? [];
  const dataConfidence = person.decision_reasons?.dataConfidence ?? person.confidence;
  const confidenceBand = confidenceBandFromConfidence(dataConfidence);

  return (
    <li className="rounded-md border border-border/60 bg-surface/40 px-2 py-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-medium text-foreground">{name}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {person.role ?? "Cargo não informado"}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          {score != null && (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
                BAND_STYLE[band],
              )}
            >
              {score}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            Decisão {BAND_LABEL[band].toLowerCase()}
          </span>
        </div>
      </div>

      {/* Relação que saiu do quadro vigente continua visível — some da fonte,
       * não da história da empresa —, mas marcada. */}
      {!person.is_current && (
        <p className="mt-1 text-[10.5px] text-muted-foreground">
          Não consta mais no quadro vigente.
        </p>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        Por que este score
      </button>

      {open && (
        <div className="mt-1 space-y-1 border-t border-border/50 pt-1">
          <ul className="space-y-0.5">
            {reasons.map((reason, i) => (
              <li
                key={`${reason}-${i}`}
                className="flex items-start gap-1 text-[11px] text-foreground"
              >
                <ShieldCheck className="mt-[1px] h-3 w-3 shrink-0 text-primary" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
          <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[10.5px] text-muted-foreground">
            <dt>Fonte</dt>
            <dd className="text-right text-foreground">
              {SOURCE_LABEL[person.source] ?? person.source}
            </dd>
            <dt>Provedor</dt>
            <dd className="text-right text-foreground">
              {PROVIDER_LABEL[person.source_provider] ?? person.source_provider}
            </dd>
            <dt>Confiança do dado</dt>
            <dd className="text-right text-foreground">{CONFIDENCE_LABEL[confidenceBand]}</dd>
            <dt>Verificado em</dt>
            <dd className="text-right text-foreground">
              {new Date(person.fetched_at).toLocaleDateString("pt-BR")}
            </dd>
            {person.started_at && (
              <>
                <dt>Na sociedade desde</dt>
                <dd className="text-right text-foreground">
                  {new Date(person.started_at).toLocaleDateString("pt-BR")}
                </dd>
              </>
            )}
          </dl>
          {person.member_type === "company" && (
            <p className="text-[10.5px] text-muted-foreground">
              Sócio pessoa jurídica
              {person.legal_representative_name
                ? ` — representante legal: ${person.legal_representative_name}`
                : " — representante legal não informado"}
              .
            </p>
          )}
          {/* Sem CPF: identidade vem só do nome, e o usuário precisa saber
           * disso antes de tratar dois homônimos como a mesma pessoa. */}
          {person.people != null && person.people.identity_confidence < 0.85 && (
            <p className="text-[10.5px] text-muted-foreground">
              Identidade resolvida apenas pelo nome — homônimos podem se confundir.
            </p>
          )}
        </div>
      )}
    </li>
  );
}

export function CompanyPeopleSection({
  placeId,
  /** Se o cadastro já foi consultado alguma vez. Distingue "não consultei" de
   * "consultei e a fonte não publicou quadro societário". */
  hasBeenLookedUp,
  isLoadingRegistration,
}: {
  placeId: string;
  hasBeenLookedUp: boolean;
  isLoadingRegistration: boolean;
}) {
  const { data: people, isLoading } = useCompanyPeople(placeId);
  const rows = people ?? [];

  return (
    <div className="mt-3 border-t border-border/60 pt-2">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Users className="h-3 w-3" />
          Decisores
        </p>
        {rows.length > 0 && (
          <span className="text-[10.5px] text-muted-foreground">
            {rows.length === 1 ? "1 pessoa identificada" : `${rows.length} pessoas identificadas`}
          </span>
        )}
      </div>

      {isLoading || isLoadingRegistration ? (
        <p className="mt-1 text-[11.5px] text-muted-foreground">Identificando decisores…</p>
      ) : !hasBeenLookedUp ? (
        <p className="mt-1 text-[11.5px] text-muted-foreground">
          Identificamos os decisores a partir do CNPJ. Informe o CNPJ abaixo para consultar.
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-1 text-[11.5px] text-muted-foreground">
          Nenhuma pessoa encontrada nesta fonte.
        </p>
      ) : (
        <ul className="mt-1.5 space-y-1.5">
          {rows.map((person) => (
            <PersonCard key={person.id} person={person} />
          ))}
        </ul>
      )}
    </div>
  );
}
