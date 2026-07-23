import { memo } from "react";
import type { DiscoveryResult } from "@/repositories/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, Globe, GlobeLock, Star, MapPin, PlusCircle, Check } from "lucide-react";
import { useLeadsStore } from "@/stores";
import { useAddToFunnelMutation } from "@/hooks/useLeadsQuery";
import { formatDistance } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const tempClass: Record<DiscoveryResult["temperature"], string> = {
  hot: "text-hot",
  warm: "text-warm",
  cold: "text-cold",
};

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
  const addToFunnel = useAddToFunnelMutation();
  const isFocused = focusedId === result.placeId;
  const inFunnel = result.importedLeadId != null;

  const openWhats = () => {
    const num = (result.phone ?? "").replace(/\D/g, "");
    if (!num) return toast.error("Sem telefone");
    if (!inFunnel) addToFunnel.mutate({ searchId, placeId: result.placeId, stage: "contacted" });
    window.open(`https://wa.me/${num}`, "_blank");
  };

  const addFunnel = () =>
    addToFunnel.mutate(
      { searchId, placeId: result.placeId, stage: "new" },
      { onSuccess: () => toast.success("Adicionado ao funil") },
    );

  return (
    <Card
      onClick={() => setFocused(result.placeId)}
      className={cn(
        "group relative cursor-pointer border-border/70 p-3 shadow-elegant transition-all hover:border-primary/50 hover:shadow-elevated",
        isFocused && "border-info ring-1 ring-info/40 bg-info/5",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-sm font-semibold text-foreground">{result.name}</h3>
            {result.hasWebsite ? (
              <Globe className="h-3 w-3 shrink-0 text-muted-foreground/60" aria-label="Com site" />
            ) : (
              <GlobeLock className="h-3 w-3 shrink-0 text-hot" aria-label="Sem site" />
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">{result.category ?? ""}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className={cn("text-xs font-bold tabular-nums", tempClass[result.temperature])}>
            {result.score}
          </span>
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <MapPin className="h-3 w-3" />
        <span className="tabular-nums">{formatDistance(result.distanceKm)}</span>
        {result.rating != null && (
          <>
            <span>•</span>
            <Star className="h-3 w-3 fill-warm text-warm" />
            <span className="font-medium tabular-nums text-foreground">
              {result.rating.toFixed(1)}
            </span>
            <span>({result.reviewCount ?? 0})</span>
          </>
        )}
        {result.phone && (
          <>
            <span>•</span>
            <span className="tabular-nums">{result.phone}</span>
          </>
        )}
      </div>

      <div className="mt-2 flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 px-2 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            openWhats();
          }}
        >
          <MessageCircle className="h-3 w-3" /> WhatsApp
        </Button>
        {inFunnel ? (
          <span className="inline-flex h-7 items-center gap-1 rounded-md bg-success/15 px-2 text-xs font-medium text-success">
            <Check className="h-3 w-3" /> No funil
          </span>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              addFunnel();
            }}
          >
            <PlusCircle className="h-3 w-3" /> Funil
          </Button>
        )}
      </div>
    </Card>
  );
});
