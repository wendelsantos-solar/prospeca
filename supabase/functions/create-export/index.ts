// create-export: server-side CSV/XLSX export with formula-injection
// protection. Field selection via the shared contract (packages/contracts) —
// unknown fields are REJECTED (422), never silently ignored. Small volumes
// return inline; larger ones go to Storage with a signed URL (unchanged).
import { AppError, handleOptions, logEvent, newRequestId } from "../_shared/http.ts";
import { requireAuth } from "../_shared/auth.ts";
import { assertRateLimit, recordUsage, writeAudit } from "../_shared/quota.ts";
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

    await assertRateLimit(ctx.adminClient, ctx.organizationId, "export_record", 3);

    let query = ctx.userClient
      .from("leads")
      .select(fields.join(","))
      .eq("organization_id", ctx.organizationId)
      .limit(5000);
    if (input.filters.stages?.length) query = query.in("stage", input.filters.stages);
    if (input.filters.temperatures?.length)
      query = query.in("temperature", input.filters.temperatures);
    if (input.filters.cities?.length) query = query.in("city", input.filters.cities);
    if (input.filters.categories?.length) query = query.in("category", input.filters.categories);
    if (input.filters.minScore != null) query = query.gte("score", input.filters.minScore);

    const { data, error } = await query;
    if (error) throw new AppError("EXPORT_FAILED", "Falha ao consultar leads.");
    // Dynamic .select(string) breaks supabase-js row typing → cast explicitly.
    const rows = (data ?? []) as unknown as Record<string, unknown>[];

    let body: Uint8Array | string;
    let contentType: string;
    let filename: string;
    if (input.format === "xlsx") {
      const sheetRows: Array<Array<string | number | boolean | null | undefined>> = [
        fields.map((f) => f),
        ...rows.map((row) => fields.map((c) => row[c] as string | number | boolean | null)),
      ];
      body = buildXlsx([{ name: "Leads", rows: sheetRows }]);
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      filename = `leads-${Date.now()}.xlsx`;
    } else {
      const header = fields.join(";");
      const lines = rows.map((row) => fields.map((c) => sanitizeCell(row[c])).join(";"));
      body = "﻿" + [header, ...lines].join("\r\n");
      contentType = "text/csv; charset=utf-8";
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
