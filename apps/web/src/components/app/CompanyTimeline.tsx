import { Loader2 } from "lucide-react";
import { useCompanyTimeline } from "@/hooks/useLeadsQuery";
import { formatDateTime } from "@/lib/format";
import type { TimelineEvent } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Unified company timeline (V3-E) — SYSTEM events (jobs, sources, score
 * changes — derived from real rows) merged with COMMERCIAL events (lead
 * activities/stage history) by the pure domain rule. Falls back to the lead's
 * legacy timeline while data loads or when no company timeline exists.
 */
export function CompanyTimeline({
  placeId,
  fallback,
}: {
  placeId: string;
  fallback: TimelineEvent[];
}) {
  const { data, isLoading } = useCompanyTimeline(placeId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando timeline…
      </div>
    );
  }

  const events = data ?? [];
  if (events.length === 0) {
    return (
      <ol className="space-y-3">
        {fallback.map((t) => (
          <li key={t.id} className="flex gap-3">
            <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
            <div>
              <p className="text-sm">{t.label}</p>
              <p className="text-[11px] text-muted-foreground">{formatDateTime(t.at)}</p>
            </div>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <ol className="space-y-3">
      {events.map((e) => (
        <li key={e.id} className="flex gap-3">
          <div
            className={cn(
              "mt-1 h-2 w-2 shrink-0 rounded-full",
              e.kind === "system" ? "bg-muted-foreground/50" : "bg-primary",
            )}
            title={e.kind === "system" ? "Evento de sistema" : "Evento comercial"}
          />
          <div className="min-w-0">
            <p className="text-sm">
              {e.label}
              <span
                className={cn(
                  "ml-1.5 rounded px-1 py-0.5 align-middle text-[9px] font-semibold uppercase tracking-wide",
                  e.kind === "system"
                    ? "bg-muted text-muted-foreground"
                    : "bg-primary-soft text-primary",
                )}
              >
                {e.kind === "system" ? "sistema" : "comercial"}
              </span>
            </p>
            {e.detail && <p className="truncate text-[11px] text-muted-foreground">{e.detail}</p>}
            <p className="text-[11px] text-muted-foreground">{formatDateTime(e.at)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
