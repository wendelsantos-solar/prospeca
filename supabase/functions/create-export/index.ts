// create-export: server-side CSV/XLSX export with formula-injection
// protection. Field selection via the shared contract (packages/contracts) —
// unknown fields are REJECTED (422), never silently ignored. Small volumes
// return inline; larger ones go to Storage with a signed URL (unchanged).
import { AppError, handleOptions, logEvent, newRequestId } from "../_shared/http.ts";
import { requireAuth } from "../_shared/auth.ts";
import { assertRateLimit, recordUsage, writeAudit } from "../_shared/quota.ts";
import { assertFeatureAccess } from "../_shared/entitlements.ts";
import {
  CreateExportSchema,
  EXPORTABLE_LEAD_FIELDS,
  type ExportableLeadField,
} from "@leads/contracts/schemas";
import { buildXlsx } from "@leads/domain/xlsx";

const EXPORTABLE_COLUMNS = new Set<string>(EXPORTABLE_LEAD_FIELDS);

// CSV formula injection guard: prefix dangerous leading chars.
function sanitizeCell(value: unknown): string {
  if (value == null) return "";
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (s.includes('"') || s.includes(";") || s.includes("\n")) {
    s = `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

Deno.serve(async (req) => {
  const opts = handleOptions(req);
  if (opts) return opts;
  const requestId = newRequestId();

  try {
    const ctx = await requireAuth(req);
    const parsed = CreateExportSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Entrada inválida.");
    const input = parsed.data;

    // V3-F: `fields` is the new contract; `columns` remains as a retrocompat
    // alias. Unknown fields were already rejected by the zod enum.
    const requested = input.fields ?? ((input.columns ?? []) as ExportableLeadField[]);
    const fields = requested.filter((c) => EXPORTABLE_COLUMNS.has(c));
    if (fields.length === 0) throw new AppError("VALIDATION_ERROR", "Nenhum campo válido.");

    // Fase 4.4: o formato exportado respeita o plano (csv_export / xlsx_export
    // em billing_plans.features — free tem csv mas NÃO tem xlsx). Antes do rate
    // limit: export recusado por plano NÃO deve consumir a cota de rate limit.
    await assertFeatureAccess(
      ctx.adminClient,
      ctx.organizationId,
      input.format === "xlsx" ? "xlsx_export" : "csv_export",
    );

    // Rate limit do export: 10/min (era 3). Racional: 3 era border-line para
    // uso legítimo — o export respeita os filtros da tela e um usuário testando
    // formatos/filtros (CSV depois XLSX, ajuste de filtro) estoura 3 facilmente.
    // 10 continua anti-abuso (um export lê até 5000 linhas e grava auditoria;
    // o teto de uso fica por exportRowsPerMonth no plano).
    await assertRateLimit(ctx.adminClient, ctx.organizationId, "export_record", 10);

    let query = ctx.userClient
      .from("leads")
      .select(fields.join(","))
      .eq("organization_id", ctx.organizationId)
      .limit(5000);
    const f = input.filters;
    if (f.stages?.length) query = query.in("stage", f.stages);
    if (f.temperatures?.length) query = query.in("temperature", f.temperatures);
    if (f.cities?.length) query = query.in("city", f.cities);
    if (f.categories?.length) query = query.in("category", f.categories);
    if (f.neighborhoods?.length) query = query.in("neighborhood", f.neighborhoods);
    if (f.minScore != null) query = query.gte("score", f.minScore);
    if (f.maxScore != null) query = query.lte("score", f.maxScore);
    if (f.minRating != null) query = query.gte("rating", f.minRating);
    if (f.minReviews != null) query = query.gte("review_count", f.minReviews);
    if (f.hasWebsite === true) query = query.eq("has_website", true);
    if (f.hasWebsite === false) query = query.eq("has_website", false);
    if (f.hasPhone) query = query.not("phone", "is", null);
    if (f.hasWhatsapp) query = query.not("whatsapp", "is", null);
    if (f.hasEmail) query = query.not("email", "is", null);
    if (f.hasInstagram) query = query.not("instagram", "is", null);
    if (f.assignee != null) query = query.eq("assigned_to", f.assignee);
    if (f.discoveredAfter) query = query.gte("created_at", f.discoveredAfter);
    if (f.lastInteractionAfter) query = query.gte("last_interaction_at", f.lastInteractionAfter);
    if (f.valueMin != null) query = query.gte("estimated_value", f.valueMin);
    if (f.valueMax != null) query = query.lte("estimated_value", f.valueMax);
    if (f.search) query = query.ilike("company_name", `%${f.search}%`);

    const { data, error } = await query;
    if (error) throw new AppError("EXPORT_FAILED", "Falha ao consultar leads.");
    // Dynamic .select(string) breaks supabase-js row typing → cast explicitly.
    const rows = (data ?? []) as unknown as Record<string, unknown>[];

    let body: Uint8Array | string;
    let filename: string;
    // P1-c (Fase 4c): AMBOS os formatos voltam como application/octet-stream.
    // O FunctionsClient do supabase-js inspeciona o Content-Type e, para
    // text/*, devolve STRING — o cliente então quebrava no `instanceof Blob`.
    // Com octet-stream o SDK entrega Blob nos DOIS formatos; o nome/extensão
    // reais ficam no Content-Disposition (a UI usa a própria extensão).
    const contentType = "application/octet-stream";
    if (input.format === "xlsx") {
      const sheetRows: Array<Array<string | number | boolean | null | undefined>> = [
        fields.map((f) => f),
        ...rows.map((row) => fields.map((c) => row[c] as string | number | boolean | null)),
      ];
      body = buildXlsx([{ name: "Leads", rows: sheetRows }]);
      filename = `leads-${Date.now()}.xlsx`;
    } else {
      const header = fields.join(";");
      const lines = rows.map((row) => fields.map((c) => sanitizeCell(row[c])).join(";"));
      body = "﻿" + [header, ...lines].join("\r\n");
      filename = `leads-${Date.now()}.csv`;
    }

    await recordUsage(ctx.adminClient, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      eventType: "export_record",
      quantity: rows?.length ?? 0,
    });
    // Auditoria (V3-F): formato, campos e filtros ficam no metadata — mesma
    // tabela audit_logs, sem migration.
    await writeAudit(ctx.adminClient, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "export.created",
      entityType: "export",
      metadata: {
        rowCount: rows?.length ?? 0,
        fields,
        format: input.format,
        filters: input.filters,
      },
    });
    await ctx.adminClient.from("exports").insert({
      organization_id: ctx.organizationId,
      created_by: ctx.userId,
      format: input.format,
      status: "completed",
      filters: input.filters,
      columns: fields,
      row_count: rows?.length ?? 0,
    });

    logEvent({
      requestId,
      operation: "create-export",
      status: "ok",
      resultCount: rows?.length,
      format: input.format,
    });
    return new Response(body as BodyInit, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Access-Control-Allow-Origin": Deno.env.get("APP_URL") ?? "*",
      },
    });
  } catch (err) {
    if (err instanceof AppError) return err.toResponse(requestId, req);
    return new AppError("INTERNAL_ERROR", "Erro interno.").toResponse(requestId, req);
  }
});
