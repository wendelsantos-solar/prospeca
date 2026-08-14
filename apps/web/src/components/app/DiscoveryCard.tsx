import { memo } from "react";
import type { DiscoveryResult } from "@/repositories/types";
import { Card } from "@/components/ui/card";
import { MessageCircle, Globe, GlobeLock, Phone, Star, Plus, Eye, Flame } from "lucide-react";
import { useLeadsStore } from "@/stores";
import { useAddToFunnelMutation, useEnrichDiscoveryMutation } from "@/hooks/useLeadsQuery";
import { useOutbound } from "@/hooks/useOutbound";
import { hasWhatsAppTarget } from "@/lib/outbound";
import { formatDistance } from "@/lib/format";
import { categoryLabel } from "@/lib/category";
import { track } from "@/lib/analytics";
import { isProvisionalScore } from "@/lib/enrichment";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { ConfidenceBadge } from "@/components/shared/Badges";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useActivationStore } from "@/stores/activation";

type Temperature = DiscoveryResult["temperature"];

const TEMP_META: Record<Temperature, { label: string; ring: string; badge: string }> = {
  hot: { label: "Quente", ring: "var(--color-hot)", badge: "bg-hot-soft text-hot" },
  warm: { label: "Morno", ring: "var(--color-warm)", badge: "bg-warm-soft text-warm" },
  cold: { label: "Frio", ring: "var(--color-cold)", badge: "bg-cold-soft text-cold" },
};

/** Score dial: a conic ring filled to `score`%, tinted by lead temperature.
 * Temperature is never carried by color alone — the TemperatureBadge repeats it
 * as text + dot, and the number is always legible in the center. */
function ScoreRing({
  score,
  temperature,
  compact,
}: {
  score: number;
  temperature: Temperature;
  compact?: boolean;
}) {
  const color = TEMP_META[temperature].ring;
  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full",
        compact ? "h-9 w-9" : "h-11 w-11",
      )}
      style={{
        background: `conic-gradient(${color} ${Math.max(0, Math.min(100, score))}%, var(--color-border) 0)`,
      }}
      aria-hidden
    >
      <div className="absolute inset-[3px] rounded-full bg-surface" />
      <span
        className={cn(
          "relative z-10 font-mono font-bold tabular-nums text-foreground",
          compact ? "text-[11px]" : "text-[13px]",
        )}
      >
        {score}
      </span>
    </div>
  );
}

function TemperatureBadge({ temperature }: { temperature: Temperature }) {
  const meta = TEMP_META[temperature];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        meta.badge,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {meta.label}
    </span>
  );
}

function ChannelChip({
  has,
  title,
  children,
}: {
  has: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={has ? title : `${title} — indisponível`}
      className={cn(
        "grid h-[22px] w-[22px] place-items-center rounded-md border",
        has
          ? "border-transparent bg-primary-subtle text-primary"
          : "border-border bg-surface-2 text-muted-foreground opacity-45",
      )}
    >
      {children}
    </span>
  );
}

function MiniBtn({
  children,
  onClick,
  tone,
}: {
  children: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  tone?: "primary";
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) =>
        (e.key === "Enter" || e.key === " ") && onClick(e as unknown as React.MouseEvent)
      }
      className={cn(
        "inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
        tone === "primary"
          ? "bg-primary text-primary-foreground hover:bg-primary-hover"
          : "border border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground",
      )}
    >
      {children}
    </span>
  );
}

/** Card for a discovered business (not yet a lead). Actions materialize it into
 * the funnel: WhatsApp → 'contacted', +Funil → 'new'. */
export const DiscoveryCard = memo(function DiscoveryCard({
  result,
  searchId,
  density = "comfortable",
}: {
  result: DiscoveryResult;
  searchId: string;
  density?: "compact" | "comfortable";
}) {
  const compact = density === "compact";
  const setFocused = useLeadsStore((s) => s.setFocused);
  const focusedId = useLeadsStore((s) => s.focusedId);
  const setDetails = useLeadsStore((s) => s.setDetails);
  const setPreview = useLeadsStore((s) => s.setPreview);
  const addToFunnel = useAddToFunnelMutation();
  const enrichDiscovery = useEnrichDiscoveryMutation();
  const { openWhatsApp } = useOutbound();
  const markMilestone = useActivationStore((state) => state.mark);
  const isFocused = focusedId === result.placeId;
  const inFunnel = result.importedLeadId != null;
  const missingContact = !result.email && !result.instagram && !result.whatsapp;

  // In funnel → open the full lead drawer; otherwise a read-only discovery preview.
  const openDetails = () => {
    if (inFunnel) {
      setDetails(result.importedLeadId);
      return;
    }
    setPreview(result);
    // Lazy enrich this one business if it has a site but no contact yet.
    if (result.hasWebsite && missingContact && !enrichDiscovery.isPending) {
      enrichDiscovery.mutate({ searchId, placeId: result.placeId });
    }
  };

  const openWhats = async () => {
    const sent = await openWhatsApp(result, {
      // Contacting a discovered business materializes it as 'contacted'.
      materialize: inFunnel ? undefined : { searchId, placeId: result.placeId },
    });
    if (sent && !inFunnel) {
      track("lead_added_to_pipeline", { source: "whatsapp", score: result.score });
      markMilestone("firstLeadAdded", { source: "whatsapp", score: result.score });
    }
  };

  const addFunnel = () =>
    addToFunnel.mutate(
      { searchId, placeId: result.placeId, stage: "new" },
      {
        onSuccess: () => {
          toast.success("Adicionado ao funil");
          track("lead_added_to_pipeline", { source: "discovery", score: result.score });
          markMilestone("firstLeadAdded", { source: "discovery", score: result.score });
        },
      },
    );

  // Only offer WhatsApp when one can actually be resolved (landline → no button).
  const hasContact = hasWhatsAppTarget(result);

  return (
    <Card
      onClick={() => setFocused(result.placeId)}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-xl border-border shadow-none transition-all hover:border-border-strong hover:shadow-card",
        compact ? "p-2" : "p-3",
        isFocused && "border-sel bg-sel-soft/40 ring-2 ring-sel/25",
      )}
    >
      {isFocused && (
        <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-sel" aria-hidden />
      )}

      <div className={cn("flex items-start", compact ? "gap-2" : "gap-3")}>
        <ScoreRing score={result.score} temperature={result.temperature} compact={compact} />

        <div className="min-w-0 flex-1">
          <h3
            className={cn(
              "truncate font-semibold tracking-tight text-foreground",
              compact ? "text-[12.5px]" : "text-[13.5px]",
            )}
          >
            {result.name}
          </h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <span className="truncate">{categoryLabel(result.category)}</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="shrink-0 font-mono tabular-nums text-subtle-foreground">
              {formatDistance(result.distanceKm)}
            </span>
          </p>

          <div className={cn("flex flex-wrap items-center gap-1.5", compact ? "mt-1.5" : "mt-2")}>
            <TemperatureBadge temperature={result.temperature} />
            {isFeatureEnabled("v2ScoringInDiscovery") && result.opportunityConfidence != null && (
              <ConfidenceBadge confidence={result.opportunityConfidence} />
            )}
            {result.pipelineState == null &&
              result.enrichmentState === "failed" &&
              isFeatureEnabled("v2ScoringInDiscovery") && (
                <span className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning-soft px-1.5 py-0.5 text-[10px] font-medium text-warning-foreground">
                  score parcial
                </span>
              )}
            {result.pipelineState === "enriching" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary-soft px-1.5 py-0.5 text-[10px] font-medium text-primary">
                ⟳ enriquecendo
              </span>
            )}
            {result.pipelineState === "queued" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                ⟳ na fila
              </span>
            )}
            {result.pipelineState === "retrying" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning-soft px-1.5 py-0.5 text-[10px] font-medium text-warning-foreground">
                ⟳ reprocessando
              </span>
            )}
            {isProvisionalScore(result.enrichmentState) && (
              <span className="inline-flex items-center rounded-full border border-dashed border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                provisório
              </span>
            )}
            <ChannelChip has={!!result.phone} title="Telefone">
              <Phone className="h-3 w-3" />
            </ChannelChip>
            <ChannelChip has={result.hasWebsite} title="Site">
              {result.hasWebsite ? (
                <Globe className="h-3 w-3" />
              ) : (
                <GlobeLock className="h-3 w-3" />
              )}
            </ChannelChip>
            <ChannelChip has={!!result.whatsapp} title="WhatsApp">
              <MessageCircle className="h-3 w-3" />
            </ChannelChip>
            {result.rating != null && (
              <span className="ml-auto inline-flex items-center gap-1 text-[11.5px] text-secondary-foreground">
                <Star className="h-3 w-3 fill-warning text-warning" />
                <span className="font-mono tabular-nums">{result.rating.toFixed(1)}</span>
                <span className="text-subtle-foreground">({result.reviewCount ?? 0})</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* actions */}
      <div className={cn("flex items-center gap-1", compact ? "mt-1.5" : "mt-2.5")}>
        {hasContact && (
          <MiniBtn
            tone="primary"
            onClick={(e) => {
              e.stopPropagation();
              void openWhats();
            }}
          >
            <MessageCircle className="h-3 w-3" /> WhatsApp
          </MiniBtn>
        )}
        <MiniBtn
          onClick={(e) => {
            e.stopPropagation();
            openDetails();
          }}
        >
          <Eye className="h-3 w-3" /> Detalhes
        </MiniBtn>
        <div className="ml-auto">
          {inFunnel ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-primary-soft px-2 py-1 text-[11px] font-semibold text-primary">
              <Flame className="h-3 w-3" /> No pipeline
            </span>
          ) : (
            <MiniBtn
              tone="primary"
              onClick={(e) => {
                e.stopPropagation();
                addFunnel();
              }}
            >
              <Plus className="h-3 w-3" /> Adicionar
            </MiniBtn>
          )}
        </div>
      </div>
    </Card>
  );
});
