import { memo } from "react";
import type { DiscoveryResult } from "@/repositories/types";
import { Phone, Globe, GlobeLock, MessageCircle, Star, Plus, Eye, Flame } from "lucide-react";
import { useLeadsStore } from "@/stores";
import { useAddToFunnelMutation, useEnrichDiscoveryMutation } from "@/hooks/useLeadsQuery";
import { useOutbound } from "@/hooks/useOutbound";
import { hasWhatsAppTarget } from "@/lib/outbound";
import { formatDistance } from "@/lib/format";
import { categoryLabel } from "@/lib/category";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Temperature = DiscoveryResult["temperature"];

const TEMP_META: Record<Temperature, { label: string; ring: string; badge: string }> = {
  hot: { label: "Quente", ring: "var(--color-hot)", badge: "bg-hot-soft text-hot" },
  warm: { label: "Morno", ring: "var(--color-warm)", badge: "bg-warm-soft text-warm" },
  cold: { label: "Frio", ring: "var(--color-cold)", badge: "bg-cold-soft text-cold" },
};

function ScoreRing({ score, temperature }: { score: number; temperature: Temperature }) {
  const color = TEMP_META[temperature].ring;
  return (
    <div
      className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full"
      style={{
        background: `conic-gradient(${color} ${Math.max(0, Math.min(100, score))}%, var(--color-border) 0)`,
      }}
      aria-hidden
    >
      <div className="absolute inset-[2.5px] rounded-full bg-surface" />
      <span className="relative z-10 font-mono text-[11px] font-bold tabular-nums text-foreground">
        {score}
      </span>
    </div>
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

const Row = memo(function Row({ result, searchId }: { result: DiscoveryResult; searchId: string }) {
  const setFocused = useLeadsStore((s) => s.setFocused);
  const focusedId = useLeadsStore((s) => s.focusedId);
  const setDetails = useLeadsStore((s) => s.setDetails);
  const setPreview = useLeadsStore((s) => s.setPreview);
  const addToFunnel = useAddToFunnelMutation();
  const enrichDiscovery = useEnrichDiscoveryMutation();
  const { openWhatsApp } = useOutbound();
  const isFocused = focusedId === result.placeId;
  const inFunnel = result.importedLeadId != null;
  const meta = TEMP_META[result.temperature];

  const openDetails = () => {
    if (inFunnel) {
      setDetails(result.importedLeadId);
      return;
    }
    setPreview(result);
    if (
      result.hasWebsite &&
      !result.email &&
      !result.instagram &&
      !result.whatsapp &&
      !enrichDiscovery.isPending
    ) {
      enrichDiscovery.mutate({ searchId, placeId: result.placeId });
    }
  };

  const addFunnel = () =>
    addToFunnel.mutate(
      { searchId, placeId: result.placeId, stage: "new" },
      { onSuccess: () => toast.success("Adicionado ao funil") },
    );

  return (
    <tr
      onClick={() => {
        setFocused(result.placeId);
        openDetails();
      }}
      className={cn(
        "cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-surface-hover",
        isFocused && "bg-sel-soft/40",
      )}
    >
      <td className="py-2.5 pl-4 pr-3">
        <div className="flex items-center gap-3">
          <ScoreRing score={result.score} temperature={result.temperature} />
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-foreground">{result.name}</div>
            <div className="truncate text-[11.5px] text-muted-foreground">
              {categoryLabel(result.category)}
            </div>
          </div>
        </div>
      </td>
      <td className="px-3">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
            meta.badge,
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {meta.label}
        </span>
      </td>
      <td className="px-3">
        {result.hasWebsite ? (
          <span className="text-[12px] text-muted-foreground">Com site</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-hot">
            <GlobeLock className="h-3.5 w-3.5" /> Sem site
          </span>
        )}
      </td>
      <td className="px-3 font-mono text-[12px] tabular-nums text-secondary-foreground">
        {formatDistance(result.distanceKm)}
      </td>
      <td className="px-3">
        {result.rating != null ? (
          <span className="inline-flex items-center gap-1 text-[12px] text-secondary-foreground">
            <Star className="h-3.5 w-3.5 fill-warning text-warning" />
            <span className="font-mono tabular-nums">{result.rating.toFixed(1)}</span>
            <span className="text-subtle-foreground">({result.reviewCount ?? 0})</span>
          </span>
        ) : (
          <span className="text-subtle-foreground">—</span>
        )}
      </td>
      <td className="px-3">
        <div className="flex items-center gap-1.5">
          <ChannelChip has={!!result.phone} title="Telefone">
            <Phone className="h-3 w-3" />
          </ChannelChip>
          <ChannelChip has={result.hasWebsite} title="Site">
            {result.hasWebsite ? <Globe className="h-3 w-3" /> : <GlobeLock className="h-3 w-3" />}
          </ChannelChip>
          <ChannelChip has={!!result.whatsapp} title="WhatsApp">
            <MessageCircle className="h-3 w-3" />
          </ChannelChip>
        </div>
      </td>
      <td className="py-2.5 pl-3 pr-4">
        <div className="flex items-center justify-end gap-1.5">
          {hasWhatsAppTarget(result) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                void openWhatsApp(result, {
                  materialize: inFunnel ? undefined : { searchId, placeId: result.placeId },
                });
              }}
              title="Preparar WhatsApp"
              aria-label="Preparar WhatsApp"
              className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-secondary-foreground transition-colors hover:bg-surface-hover"
            >
              <MessageCircle className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              openDetails();
            }}
            title="Ver detalhes"
            aria-label="Ver detalhes"
            className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-secondary-foreground transition-colors hover:bg-surface-hover"
          >
            <Eye className="h-4 w-4" />
          </button>
          {inFunnel ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-primary-soft px-2 py-1.5 text-[11px] font-semibold text-primary">
              <Flame className="h-3 w-3" /> No pipeline
            </span>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                addFunnel();
              }}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-[11.5px] font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </button>
          )}
        </div>
      </td>
    </tr>
  );
});

const HEADERS = ["Empresa", "Temperatura", "Presença", "Distância", "Avaliação", "Canais", ""];

/** Full-width results table — the "Lista" view of the discovery workspace, an
 * alternative to the map. Denser and wider than the pinned sidebar list. */
export function ResultsList({
  results,
  searchId,
}: {
  results: DiscoveryResult[];
  searchId: string;
}) {
  return (
    <div className="h-full overflow-auto bg-background">
      <table className="w-full border-collapse text-left">
        <thead className="sticky top-0 z-10 bg-surface/95 backdrop-blur">
          <tr className="border-b border-border">
            {HEADERS.map((h, i) => (
              <th
                key={h || i}
                className={cn(
                  "py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                  i === 0
                    ? "pl-4 pr-3"
                    : i === HEADERS.length - 1
                      ? "pl-3 pr-4 text-right"
                      : "px-3",
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <Row key={r.placeId} result={r} searchId={searchId} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
