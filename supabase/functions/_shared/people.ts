// People persistence — materializa pessoas + relações a partir de um QSA já
// normalizado, e classifica o decisor na escrita.
//
// Compartilhado por DOIS caminhos que precisam do MESMO comportamento:
//   • lookup-cnpj      — quando a fonte acabou de responder;
//   • reprocess-decision-makers — quando a REGRA mudou e o QSA bruto já está
//     guardado, sem gastar consulta na fonte.
//
// Ter isto num lugar só é o que torna verdadeira a promessa de que a tabela de
// papéis é "facilmente ajustável" (brief §26): ajustar a lista e reprocessar
// tem que produzir exatamente o mesmo resultado que uma consulta nova.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { ResolvedPerson } from "@leads/domain/person";
import { calculateDecisionMakerScore } from "@leads/domain/decision-maker";

/**
 * Materializa pessoas + relações a partir do QSA já normalizado.
 *
 * IDEMPOTENTE por construção: `people` tem unique (organization_id,
 * normalized_name) e `company_people` tem unique (organization_id, place_id,
 * person_id, source). Reconsultar o mesmo CNPJ, ou dois requests concorrentes,
 * convergem para as MESMAS linhas — nunca duplicam.
 *
 * Relações que sumiram do QSA vigente são marcadas `is_current = false` em vez
 * de apagadas: a saída de sociedade é informação, e apagar a linha faria a
 * empresa parecer nunca ter tido aquele sócio. O expurgo LGPD continua sendo o
 * único a remover linha.
 */
export async function persistPeople(
  admin: SupabaseClient,
  organizationId: string,
  placeId: string,
  resolved: ResolvedPerson[],
): Promise<number> {
  if (resolved.length === 0) {
    // QSA vazio/ausente: nada a criar. As relações anteriores, se houver,
    // deixam de ser vigentes.
    await admin
      .from("company_people")
      .update({ is_current: false })
      .eq("organization_id", organizationId)
      .eq("place_id", placeId)
      .eq("source", "qsa");
    return 0;
  }

  const { data: people, error: peopleErr } = await admin
    .from("people")
    .upsert(
      resolved.map((r) => ({
        organization_id: organizationId,
        full_name: r.fullName,
        normalized_name: r.normalizedName,
        identity_method: r.identityMethod,
        identity_confidence: r.identityConfidence,
      })),
      { onConflict: "organization_id,normalized_name" },
    )
    .select("id, normalized_name");
  if (peopleErr) throw new Error(`people upsert: ${peopleErr.message}`);

  const idByName = new Map<string, string>(
    (people ?? []).map((p) => [p.normalized_name as string, p.id as string]),
  );

  const rows = resolved
    .map((r) => {
      const personId = idByName.get(r.normalizedName);
      if (!personId) return null;
      // Decision Maker (Fase 5) — determinístico, calculado na escrita para que
      // a leitura seja barata. Reprocessar é só rodar o classificador de novo
      // sobre o QSA bruto, sem gastar consulta na fonte.
      const decision = calculateDecisionMakerScore({
        role: r.relation.role,
        memberType: r.relation.memberType,
        isCurrent: r.relation.isCurrent,
        confidence: r.relation.confidence,
        source: r.relation.source,
        startedAt: r.relation.startedAt,
        legalRepresentativeName: r.relation.legalRepresentativeName,
      });
      return {
        organization_id: organizationId,
        place_id: placeId,
        person_id: personId,
        role: r.relation.role,
        role_code: r.relation.roleCode,
        role_band: decision.band,
        decision_score: decision.score,
        decision_reasons: {
          version: decision.version,
          reasons: decision.reasons,
          dataConfidence: decision.dataConfidence,
        },
        member_type: r.relation.memberType,
        source: r.relation.source,
        source_provider: r.relation.sourceProvider,
        confidence: r.relation.confidence,
        started_at: r.relation.startedAt,
        ended_at: r.relation.endedAt,
        is_current: r.relation.isCurrent,
        legal_representative_name: r.relation.legalRepresentativeName,
        legal_representative_role: r.relation.legalRepresentativeRole,
        fetched_at: new Date().toISOString(),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const { error: relErr } = await admin
    .from("company_people")
    .upsert(rows, { onConflict: "organization_id,place_id,person_id,source" });
  if (relErr) throw new Error(`company_people upsert: ${relErr.message}`);

  // Quem não veio no QSA vigente deixa de ser relação atual.
  const currentIds = rows.map((r) => r.person_id);
  await admin
    .from("company_people")
    .update({ is_current: false })
    .eq("organization_id", organizationId)
    .eq("place_id", placeId)
    .eq("source", "qsa")
    .not("person_id", "in", `(${currentIds.join(",")})`);

  return rows.length;
}
