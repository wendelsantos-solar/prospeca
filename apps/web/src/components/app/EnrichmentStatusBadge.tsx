import { Loader2 } from "lucide-react";
import {
  ENRICHMENT_STATUS_META,
  type EnrichmentStatusMeta,
  type EnrichmentStatusState,
} from "@/lib/enrichment";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<EnrichmentStatusMeta["tone"], string> = {
  primary: "border-primary/30 bg-primary-soft text-primary",
  warning: "border-warning/40 bg-warning-soft text-warning-foreground",
  muted: "text-muted-foreground",
};

/** The single async-status badge of a DiscoveryCard: queued / enriching /
 * retrying / failed ("score parcial") / provisional ("provisório").
 * In-flight states spin (respecting prefers-reduced-motion); all states
 * announce themselves to assistive tech via role="status" + aria-live. */
export function EnrichmentStatusBadge({ state }: { state: EnrichmentStatusState }) {
  const meta = ENRICHMENT_STATUS_META[state];
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={meta.ariaLabel}
      title={meta.title}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
        meta.dashed ? "border border-dashed border-border" : "border",
        TONE_CLASS[meta.tone],
      )}
    >
      {meta.spinner && (
        <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" aria-hidden />
      )}
      {meta.label}
    </span>
  );
}
