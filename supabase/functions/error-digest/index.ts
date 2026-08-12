// error-digest: periodic sweeper (backstop, same shape as
// recover-stuck-searches). error_events was write-only — nothing surfaced it
// anywhere, not even the admin panel, so a broken flow could repeat for a
// paying customer indefinitely with nobody noticing. This emails a summary
// whenever new error-severity rows show up since the last run window.
//
// No dedup watermark table on purpose: runs every ~30min (see cron
// migration) over the last 35min — a small overlap is fine for a
// notification (better a duplicate ping than a missed one).
import { AppError, handleOptions, json, logEvent, newRequestId } from "../_shared/http.ts";
import { adminClient } from "../_shared/auth.ts";
import { isInternalCall } from "../_shared/internal-auth.ts";
import { sendEmail } from "../_shared/email.ts";

const WINDOW_MS = 35 * 60_000;
const MAX_ROWS = 500;

Deno.serve(async (req) => {
  const opts = handleOptions(req);
  if (opts) return opts;
  const requestId = newRequestId();

  if (!(await isInternalCall(req))) {
    return new AppError("FORBIDDEN", "Função interna.").toResponse(requestId, req);
  }

  const notifyTo = Deno.env.get("ADMIN_ALERT_EMAIL");
  if (!notifyTo) {
    logEvent({ requestId, operation: "error-digest", status: "no_notify_email" });
    return json({ skipped: "no ADMIN_ALERT_EMAIL configured" }, 200, {}, req);
  }

  const admin = adminClient();
  const since = new Date(Date.now() - WINDOW_MS).toISOString();

  const { data: rows, error } = await admin
    .from("error_events")
    .select("source, location, message, severity, created_at")
    .eq("severity", "error")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);

  if (error) throw new AppError("INTERNAL_ERROR", "Falha ao consultar error_events.");
  if (!rows || rows.length === 0) {
    logEvent({ requestId, operation: "error-digest", status: "ok", resultCount: 0 });
    return json({ notified: false, count: 0 }, 200, {}, req);
  }

  // Group by (source, location, message) so one repeated failure is one
  // line with a count, not a wall of duplicates.
  const grouped = new Map<string, { count: number; source: string; location: string | null }>();
  for (const r of rows) {
    const key = `${r.source}|${r.location ?? ""}|${r.message}`;
    const g = grouped.get(key);
    if (g) g.count++;
    else grouped.set(key, { count: 1, source: r.source, location: r.location });
  }
  const lines = [...grouped.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([key, g]) => {
      const message = key.split("|").slice(2).join("|");
      return `<li><strong>${g.count}x</strong> [${g.source}${g.location ? `/${g.location}` : ""}] ${message}</li>`;
    });

  await sendEmail({
    to: notifyTo,
    subject: `Prospeca — ${rows.length} erro(s) nos últimos ~35min`,
    html: `<p>${rows.length} erro(s) registrados, agrupados abaixo:</p><ul>${lines.join("")}</ul>`,
  });

  logEvent({ requestId, operation: "error-digest", status: "ok", resultCount: rows.length });
  return json({ notified: true, count: rows.length }, 200, {}, req);
});
