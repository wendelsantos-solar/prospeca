import { pickPrimaryDecisionMaker, type DecisionMakerHint } from "@leads/domain";
import { useCompanyPeople } from "./useLeadsQuery";

/**
 * O decisor a procurar nesta empresa, ou null quando não há um honesto.
 *
 * Fica separado de `useCompanyPeople` porque a lista completa (drawer de
 * decisores) e a escolha do PRIMEIRO a abordar (NBA) são perguntas diferentes:
 * a lista mostra todo mundo, inclusive banda baixa; esta escolhe alguém só
 * quando a classificação sustenta a indicação.
 */
export function usePrimaryDecisionMaker(placeId?: string | null): DecisionMakerHint | null {
  const { data } = useCompanyPeople(placeId);
  const primary = pickPrimaryDecisionMaker(
    (data ?? [])
      .map((row) => ({
        name: row.people?.full_name ?? "",
        role: row.role,
        score: row.decision_score ?? 0,
        dataConfidence: row.confidence,
        band: row.role_band ?? ("unknown" as const),
        isCurrent: row.is_current,
      }))
      .filter((p) => p.name),
  );
  if (!primary) return null;
  return {
    name: primary.name,
    role: primary.role,
    score: primary.score,
    band: primary.band,
  };
}
