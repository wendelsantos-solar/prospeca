// reprocess-decision-makers: recomputa a classificação de decisor sobre o QSA
// BRUTO já guardado, sem consultar fonte externa nenhuma.
//
// Por que existe: `DECISION_ROLE_RULES` precisa ser "centralizada e facilmente
// ajustável" (brief §26). Ajustável só é verdade se existir caminho para
// aplicar a lista nova ao que já está no banco — senão ajustar a tabela muda o
// comportamento de empresas futuras e deixa a base inteira com a classificação
// velha, em silêncio.
//
// O modelo HÍBRIDO (D4) é o que torna isto barato: `places.qsa` guarda o
// snapshot bruto da fonte, então reprocessar lê do próprio banco. Zero
// requisição à BrasilAPI, zero quota, zero custo.
//
// SELEÇÃO POR VERSÃO: por padrão só reprocessa relações cuja
// `decision_reasons.version` difere da corrente — rodar duas vezes seguidas
// não faz trabalho na segunda. `force` ignora a versão (para quando a lista de
// papéis mudou sem bump de versão do score).
//
// Acesso: administrador da plataforma (mesma porta de retry-job) ou chamada
// interna service-role. Nunca exposto ao usuário final — é manutenção.
import { z } from "npm:zod@3";
import { AppError, handleOptions, json, logEvent, newRequestId } from "../_shared/http.ts";
import { adminClient, requireAuth } from "../_shared/auth.ts";
import { isInternalCall } from "../_shared/internal-auth.ts";
import { resolvePeopleFromQsa } from "@leads/domain/person";
import { DECISION_MAKER_SCORE_VERSION } from "@leads/domain/decision-maker";
import type { QsaMember } from "@leads/domain/business-registry";
import { persistPeople } from "../_shared/people.ts";

const InputSchema = z.object({
  /** Restringe a uma organização. Obrigatório na chamada interna. */
  organizationId: z.string().uuid().optional(),
  /** Restringe a places específicos (ignora o filtro de versão). */
  placeIds: z.array(z.string().uuid()).max(500).optional(),
  /** Recomputa mesmo quando a versão já é a corrente. */
  force: z.boolean().optional(),
  /** Teto de empresas por chamada — reprocessar é barato, mas não ilimitado. */
  limit: z.number().int().min(1).max(500).optional(),
});

const DEFAULT_LIMIT = 200;

Deno.serve(async (req) => {
  const opts = handleOptions(req);
  if (opts) return opts;
  const requestId = newRequestId();

  try {
    const parsed = InputSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Entrada inválida.");
    const { placeIds, force, limit } = parsed.data;

    const internal = await isInternalCall(req);
    let organizationId: string | null = parsed.data.organizationId ?? null;

    if (internal) {
      if (!organizationId) {
        throw new AppError("VALIDATION_ERROR", "organizationId obrigatório (chamada interna).");
      }
    } else {
      const ctx = await requireAuth(req);
      const { data: isAdmin, error: gateErr } = await ctx.userClient.rpc("is_platform_admin");
      if (gateErr || !isAdmin) {
        throw new AppError("FORBIDDEN", "Acesso restrito ao administrador da plataforma.");
      }
      // Admin pode mirar uma org específica; sem isso, a própria.
      organizationId = organizationId ?? ctx.organizationId;
    }

    const admin = adminClient();

    // Candidatos: empresas COM QSA guardado na organização alvo. Sem QSA não há
    // o que reclassificar — e nunca se consulta a fonte aqui.
    let placeQuery = admin
      .from("places")
      .select("id, qsa")
      .eq("organization_id", organizationId)
      .not("qsa", "is", null)
      .limit(limit ?? DEFAULT_LIMIT);
    if (placeIds?.length) placeQuery = placeQuery.in("id", placeIds);
    const { data: places, error: placesError } = await placeQuery;
    if (placesError) throw new AppError("INTERNAL_ERROR", placesError.message);

    const candidates = (places ?? []) as Array<{ id: string; qsa: QsaMember[] | null }>;

    // Versão já aplicada por empresa — evita reescrever o que já está corrente.
    const upToDate = new Set<string>();
    if (!force && !placeIds?.length && candidates.length > 0) {
      const { data: rels } = await admin
        .from("company_people")
        .select("place_id, decision_reasons")
        .eq("organization_id", organizationId)
        .in(
          "place_id",
          candidates.map((c) => c.id),
        )
        .eq("source", "qsa");
      const byPlace = new Map<string, boolean>();
      for (const rel of (rels ?? []) as Array<Record<string, unknown>>) {
        const version = (rel.decision_reasons as { version?: string } | null)?.version ?? null;
        const current = version === DECISION_MAKER_SCORE_VERSION;
        const key = rel.place_id as string;
        // Uma empresa só está em dia se TODAS as suas relações estiverem.
        byPlace.set(key, (byPlace.get(key) ?? true) && current);
      }
      for (const [placeId, ok] of byPlace) if (ok) upToDate.add(placeId);
    }

    let reprocessed = 0;
    let peopleWritten = 0;
    let skipped = 0;

    for (const place of candidates) {
      if (upToDate.has(place.id)) {
        skipped++;
        continue;
      }
      // A MESMA função que o lookup usa — reprocessar tem que produzir
      // exatamente o que uma consulta nova produziria.
      const written = await persistPeople(
        admin,
        organizationId!,
        place.id,
        resolvePeopleFromQsa(place.qsa),
      );
      peopleWritten += written;
      reprocessed++;
    }

    logEvent({
      requestId,
      organizationId: organizationId ?? undefined,
      operation: "reprocess-decision-makers",
      status: "ok",
      resultCount: reprocessed,
    });

    return json(
      {
        reprocessed,
        skipped,
        peopleWritten,
        scoreVersion: DECISION_MAKER_SCORE_VERSION,
        candidates: candidates.length,
      },
      200,
      {},
      req,
    );
  } catch (err) {
    if (err instanceof AppError) return err.toResponse(requestId, req);
    logEvent({ requestId, operation: "reprocess-decision-makers", status: "error" });
    return new AppError("INTERNAL_ERROR", "Erro interno.").toResponse(requestId, req);
  }
});
