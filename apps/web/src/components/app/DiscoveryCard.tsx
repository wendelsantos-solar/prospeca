import { memo } from "react";
import type { DiscoveryResult } from "@/repositories/types";
import { Card } from "@/components/ui/card";
import {
  MessageCircle,
  Globe,
  GlobeLock,
  Star,
  MapPin,
  Plus,
  Check,
  Eye,
  Flame,
} from "lucide-react";
import { useLeadsStore } from "@/stores";
import {
  useAddToFunnelMutation,
  useEnrichDiscoveryMutation,
  useSuppressionHashes,
} from "@/hooks/useLeadsQuery";
import { isContactSuppressed } from "@/lib/suppression";
import { formatDistance } from "@/lib/format";
import { categoryLabel } from "@/lib/category";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const tempBadgeClass: Record<DiscoveryResult["temperature"], string> = {
  hot: "bg-primary text-primary-foreground",
  warm: "bg-warning/15 text-warning-foreground",
  cold: "bg-muted text-muted-foreground",
};

function ScoreBadge({
  score,
  temperature,
}: {
  score: number;
  temperature: DiscoveryResult["temperature"];
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold",
        tempBadgeClass[temperature],
      )}
    >
      {temperature === "hot" && <Flame className="h-3 w-3" />}
      {score}
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
        "inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-[10.5px] font-medium transition-colors",
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
}: {
  result: DiscoveryResult;
  searchId: string;
}) {
  const setFocused = useLeadsStore((s) => s.setFocused);
  const focusedId = useLeadsStore((s) => s.focusedId);
  const setDetails = useLeadsStore((s) => s.setDetails);
  const setPreview = useLeadsStore((s) => s.setPreview);
  const addToFunnel = useAddToFunnelMutation();
  const enrichDiscovery = useEnrichDiscoveryMutation();
  const { data: suppressed } = useSuppressionHashes();
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
    const num = (result.phone ?? "").replace(/\D/g, "");
    if (!num) return toast.error("Sem telefone");
    if (suppressed && (await isContactSuppressed(suppressed, result))) {
      return toast.error("Contato em opt-out — não contatar (LGPD).");
    }
    if (!inFunnel) addToFunnel.mutate({ searchId, placeId: result.placeId, stage: "contacted" });
    window.open(`https://wa.me/${num}`, "_blank");
  };

  const addFunnel = () =>
    addToFunnel.mutate(
      { searchId, placeId: result.placeId, stage: "new" },
      { onSuccess: () => toast.success("Adicionado ao funil") },
    );

  const hasContact = !!result.phone;

  return (
    <Card
      onClick={() => setFocused(result.placeId)}
      className={cn(
        "group relative cursor-pointer rounded-xl border-border p-3 shadow-none transition-all hover:border-border-strong hover:shadow-card",
        isFocused && "border-info ring-1 ring-info/40 bg-info/5",
      )}
    >
      {/* line 1 */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13.5px] font-semibold text-foreground">
              {result.name}
            </span>
            {result.hasWebsite ? (
              <Globe className="h-3 w-3 shrink-0 text-muted-foreground/60" aria-label="Com site" />
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
            {categoryLabel(result.category)}
          </p>
        </div>
        <ScoreBadge score={result.score} temperature={result.temperature} />
      </div>

      {/* line 3 */}
      <div className="mt-2.5 flex items-center gap-3 text-[11.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {formatDistance(result.distanceKm)}
        </span>
        {result.rating != null && (
          <span className="inline-flex items-center gap-1">
            <Star className="h-3 w-3 fill-warning text-warning" />
            {result.rating.toFixed(1)}{" "}
            <span className="text-subtle-foreground">({result.reviewCount ?? 0})</span>
          </span>
        )}
        {!result.hasWebsite && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-warning/12 px-1.5 py-0.5 text-[10.5px] font-medium text-warning-foreground">
            <GlobeLock className="h-3 w-3" /> Sem site
          </span>
        )}
      </div>

      {/* actions */}
      <div className="mt-2.5 flex items-center gap-1">
        {hasContact && (
          <MiniBtn
            tone="primary"
            onClick={(e) => {
              e.stopPropagation();
              openWhats();
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
            <span className="inline-flex items-center gap-1 rounded-md bg-primary-soft px-1.5 py-1 text-[10.5px] font-semibold text-primary">
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
