// get-notifications: gera (on-demand), lista, marca lida e descarta as
// notificações do usuário.
//
// As notificações são DERIVADAS do funil pela MESMA regra pura usada no
// cliente (packages/domain/src/notifications.ts) e persistidas por
// (organization_id, user_id, notification_key), então `read_at`/`dismissed_at`
// sobrevivem a reload e sincronizam entre aparelhos. O upsert preserva o
// estado lido; notificações que deixaram de valer (lead ganho/descansado/
// destravado) são removidas — um lead que "destrava" e depois para de novo
// volta como NÃO lida (evento novo), em vez de reaparecer já lida.
import { z } from "npm:zod@3";
import { AppError, handleOptions, json, logEvent, newRequestId } from "../_shared/http.ts";
import { requireAuth } from "../_shared/auth.ts";
import { generateNotifications } from "@leads/domain/notifications";

const InputSchema = z.object({
  action: z.enum(["list", "mark_read", "mark_all_read", "dismiss_all"]).default("list"),
  key: z.string().optional(),
});

// Só os estágios que o domínio usa no rótulo da notificação "Lead parado".
const STAGE_LABELS: Record<string, string> = {
  qualified: "Qualificado",
  contacted: "Contatado",
};

Deno.serve(async (req) => {
  const opts = handleOptions(req);
  if (opts) return opts;
  const requestId = newRequestId();
  const startedAt = Date.now();

  try {
    const ctx = await requireAuth(req);
    const admin = ctx.adminClient;
    const org = ctx.organizationId;
    const user = ctx.userId;
    const body = await req.json().catch(() => ({}));
    const parsed = InputSchema.safeParse(body);
    const action = parsed.success ? parsed.data.action : "list";
    const key = parsed.success ? parsed.data.key : undefined;
    const nowIso = new Date().toISOString();

    // ── Mutações de leitura/descarte ──────────────────────────────────────
    if (action === "mark_read" && key) {
      await admin
        .from("notifications")
        .update({ read_at: nowIso })
        .eq("organization_id", org)
        .eq("user_id", user)
        .eq("notification_key", key);
    } else if (action === "mark_all_read") {
      await admin
        .from("notifications")
        .update({ read_at: nowIso })
        .eq("organization_id", org)
        .eq("user_id", user)
        .is("read_at", null);
    } else if (action === "dismiss_all") {
      await admin
        .from("notifications")
        .update({ dismissed_at: nowIso })
        .eq("organization_id", org)
        .eq("user_id", user)
        .is("dismissed_at", null);
    }

    // ── Geração on-demand + upsert (idempotente, preserva read_at) ───────
    const { data: leads } = await admin
      .from("leads")
      .select(
        "id, company_name, stage, temperature, last_interaction_at, created_at, has_website, rating, review_count, instagram, whatsapp, lead_activities(id, title, status, scheduled_at)",
      )
      .eq("organization_id", org);

    const notifications = generateNotifications(
      (leads ?? []).map((l) => ({
        id: l.id as string,
        companyName: l.company_name as string,
        stage: l.stage as string,
        temperature: l.temperature as string | null,
        lastInteractionAt: l.last_interaction_at as string | null,
        discoveredAt: l.created_at as string | null,
        hasWebsite: l.has_website as boolean,
        rating: l.rating as number | null,
        reviewCount: l.review_count as number | null,
        instagram: l.instagram as string | null,
        whatsapp: l.whatsapp as string | null,
        activities: ((l.lead_activities ?? []) as Array<{
          id: string;
          title?: string | null;
          status?: string | null;
          scheduled_at?: string | null;
        }>).map((a) => ({
          id: a.id,
          title: a.title ?? undefined,
          date: a.scheduled_at ?? null,
          done: a.status === "completed",
        })),
      })),
      STAGE_LABELS,
    );

    const rows = notifications.map((n) => ({
      organization_id: org,
      user_id: user,
      kind: n.kind,
      title: n.title,
      description: n.description ?? null,
      lead_id: n.leadId ?? null,
      notification_key: n.id,
      created_at: n.createdAt,
    }));

    if (rows.length > 0) {
      // merge-duplicates: atualiza só as colunas enviadas (read_at/dismissed_at
      // NÃO estão em `rows`, então são preservadas no conflito).
      await admin.from("notifications").upsert(rows, {
        onConflict: "organization_id,user_id,notification_key",
      });
    }

    // Limpeza de obsoletas: notificações que deixaram de valer somem.
    const { data: existingRows } = await admin
      .from("notifications")
      .select("notification_key")
      .eq("organization_id", org)
      .eq("user_id", user);
    const currentKeys = new Set(rows.map((r) => r.notification_key));
    const staleKeys = (existingRows ?? [])
      .map((e) => e.notification_key as string)
      .filter((k) => !currentKeys.has(k));
    if (staleKeys.length > 0) {
      await admin
        .from("notifications")
        .delete()
        .eq("organization_id", org)
        .eq("user_id", user)
        .in("notification_key", staleKeys);
    }

    // ── Leitura final ─────────────────────────────────────────────────────
    const { data: stored } = await admin
      .from("notifications")
      .select("notification_key, kind, title, description, lead_id, read_at, dismissed_at, created_at")
      .eq("organization_id", org)
      .eq("user_id", user)
      .is("dismissed_at", null)
      .order("created_at", { ascending: false })
      .limit(50);

    const items = (stored ?? []).map((n) => ({
      id: n.notification_key as string,
      kind: n.kind as string,
      title: n.title as string,
      description: n.description as string | null,
      leadId: n.lead_id as string | null,
      createdAt: n.created_at as string,
      readAt: n.read_at as string | null,
      dismissedAt: n.dismissed_at as string | null,
    }));
    const unread = items.filter((n) => n.readAt == null).length;

    logEvent({
      requestId,
      organizationId: org,
      operation: "get-notifications",
      action,
      durationMs: Date.now() - startedAt,
      resultCount: items.length,
      status: "completed",
    });

    return json({ items, unread }, 200, {}, req);
  } catch (err) {
    logEvent({ requestId, operation: "get-notifications", status: "error" });
    if (err instanceof AppError) return err.toResponse(requestId, req);
    return new AppError("INTERNAL_ERROR", "Erro interno.").toResponse(requestId, req);
  }
});
