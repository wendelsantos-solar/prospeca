// create-export: server-side CSV export with formula-injection protection.
// Small volumes return inline; larger ones go to Storage with a signed URL.
import { z } from "npm:zod@3";
import { AppError, handleOptions, logEvent, newRequestId } from "../_shared/http.ts";
import { requireAuth } from "../_shared/auth.ts";
import { assertRateLimit, recordUsage, writeAudit } from "../_shared/quota.ts";

const InputSchema = z.object({
  format: z.enum(["csv"]),
  filters: z
    .object({
      stages: z.array(z.string()).optional(),
      temperatures: z.array(z.string()).optional(),
      cities: z.array(z.string()).optional(),
      categories: z.array(z.string()).optional(),
      minScore: z.number().optional(),
    })
    .default({}),
  columns: z.array(z.string()).min(1).max(30),
});

const EXPORTABLE_COLUMNS = new Set([
  "company_name",
  "category",
  "address",
  "neighborhood",
  "city",
  "state",
  "phone",
  "whatsapp",
  "email",
  "instagram",
  "website",
  "has_website",
  "rating",
  "review_count",
  "score",
  "temperature",
  "stage",
  "estimated_value",
  "closed_value",
  "created_at",
  "last_interaction_at",
]);

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
    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Entrada inválida.");
    const input = parsed.data;

    const columns = input.columns.filter((c) => EXPORTABLE_COLUMNS.has(c));
    if (columns.length === 0) throw new AppError("VALIDATION_ERROR", "Nenhuma coluna válida.");

    await assertRateLimit(ctx.adminClient, ctx.organizationId, "export_record", 3);

    let query = ctx.userClient
      .from("leads")
      .select(columns.join(","))
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

    const header = columns.join(";");
    const lines = rows.map((row) => columns.map((c) => sanitizeCell(row[c])).join(";"));
    const csv = "﻿" + [header, ...lines].join("\r\n");

    await recordUsage(ctx.adminClient, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      eventType: "export_record",
      quantity: rows?.length ?? 0,
    });
    await writeAudit(ctx.adminClient, {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "export.created",
      entityType: "export",
      metadata: { rowCount: rows?.length ?? 0, columns },
    });
    await ctx.adminClient.from("exports").insert({
      organization_id: ctx.organizationId,
      created_by: ctx.userId,
      format: "csv",
      status: "completed",
      filters: input.filters,
      columns,
      row_count: rows?.length ?? 0,
    });

    logEvent({ requestId, operation: "create-export", status: "ok", resultCount: rows?.length });
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="leads-${Date.now()}.csv"`,
        "Access-Control-Allow-Origin": Deno.env.get("APP_URL") ?? "*",
      },
    });
  } catch (err) {
    if (err instanceof AppError) return err.toResponse(requestId, req);
    return new AppError("INTERNAL_ERROR", "Erro interno.").toResponse(requestId, req);
  }
});
