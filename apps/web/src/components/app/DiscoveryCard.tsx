import { memo } from "react";
import type { DiscoveryResult } from "@/repositories/types";
import { Card } from "@/components/ui/card";
import { MessageCircle, Phone, Star, Flame, Instagram, Share2 } from "lucide-react";
import { useLeadsStore } from "@/stores";
import { useEnrichDiscoveryMutation } from "@/hooks/useLeadsQuery";
import { useOutbound } from "@/hooks/useOutbound";
import { hasWhatsAppTarget } from "@/lib/outbound";
import { formatDistance } from "@/lib/format";
import { categoryLabel } from "@/lib/category";
import { track } from "@/lib/analytics";
import { resolveEnrichmentStatus } from "@/lib/enrichment";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { ConfidenceBadge, ScoreRing, TEMP_META } from "@/components/shared/Badges";
import { EnrichmentStatusBadge } from "@/components/app/EnrichmentStatusBadge";
import { cn } from "@/lib/utils";
import { useActivationStore } from "@/stores/activation";

type Temperature = DiscoveryResult["temperature"];

/** Cor da chama por temperatura — Quente laranja (mockup), Morno âmbar,
 * Frio azul-acinzentado. Nunca cor sozinha: o rótulo acompanha. */
const FLAME_COLOR: Record<Temperature, string> = {
  hot: "text-orange-500",
  warm: "text-amber-500",
  cold: "text-slate-500",
};

/**
 * Card do resultado — anatomia do mockup (Fase 90, ~74px de base):
 * score em anel ~40px à esquerda | nome + rating na MESMA linha | linha cinza
 * 'Bairro, Cidade • distância' | chips pequenos (Quente com chama / Redes
 * fracas verde). SÓ o card SELECIONADO ganha a linha de 3 ícones circulares de
 * contato (WhatsApp/Ligar/Instagram) + borda verde + fundo verde-claro.
 * 'Adicionar' vive no header do detalhe (decisão).
 */
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
  const enrichDiscovery = useEnrichDiscoveryMutation();
  const { openWhatsApp } = useOutbound();
  const markMilestone = useActivationStore((state) => state.mark);
  const isFocused = focusedId === result.placeId;
  const inFunnel = result.importedLeadId != null;
  const missingContact = !result.email && !result.instagram && !result.whatsapp;
  // Single async-status badge: retrying > enriching > queued > failed > provisional.
  const enrichmentStatus = resolveEnrichmentStatus(result.pipelineState, result.enrichmentState);

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

  // Only offer WhatsApp when one can actually be resolved (landline → no button).
  const hasContact = hasWhatsAppTarget(result);

  // Força da presença social (derivada dos canais de fato mapeados).
  const socialStrength =
    !result.instagram && !result.whatsapp
      ? ("none" as const)
      : !!result.instagram !== !!result.whatsapp
        ? ("weak" as const)
        : ("ok" as const);

  const locationText =
    [result.neighborhood, result.city].filter(Boolean).join(", ") || categoryLabel(result.category);

  return (
    <Card
      className={cn(
        "relative cursor-pointer rounded-xl p-2.5 shadow-none transition-colors",
        isFocused
          ? "border-sel bg-sel-soft/40"
          : "border-border hover:border-border-strong hover:shadow-card",
      )}
    >
      {/* Alvo de seleção acessível (P2): botão REAL cobrindo o card, sob o
       * conteúdo — sem aninhamento inválido de interativos. Tab alcança,
       * Enter/Espaço seleciona, aria-pressed expõe o estado, foco visível.
       * Os ícones de ação vivem ACIMA (z-20) e continuam clicáveis. */}
      <button
        type="button"
        onClick={() => {
          setFocused(result.placeId);
          openDetails();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setFocused(result.placeId);
            openDetails();
          }
        }}
        aria-label={`Selecionar ${result.name}`}
        aria-pressed={isFocused}
        className="absolute inset-0 z-0 h-full w-full cursor-pointer rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1"
      />

      <div className="pointer-events-none relative z-10 flex items-start gap-2.5">
        <ScoreRing score={result.score} temperature={result.temperature} size="md" />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="truncate text-[13px] font-semibold leading-tight text-foreground">
              {result.name}
            </h3>
            {result.rating != null && (
              <span className="flex shrink-0 items-center gap-0.5 text-[11.5px] text-secondary-foreground">
                <Star className="h-3 w-3 fill-warning text-warning" />
                <span className="font-mono font-semibold tabular-nums">
                  {result.rating.toFixed(1)}
                </span>
                <span className="text-subtle-foreground">({result.reviewCount ?? 0})</span>
              </span>
            )}
          </div>

          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {locationText}
            <span className="text-muted-foreground/40"> · </span>
            <span className="font-mono tabular-nums text-subtle-foreground">
              {formatDistance(result.distanceKm)}
            </span>
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
                TEMP_META[result.temperature].badge,
              )}
            >
              <Flame className={cn("h-3 w-3", FLAME_COLOR[result.temperature])} aria-hidden />
              {TEMP_META[result.temperature].label}
            </span>
            {socialStrength !== "ok" && (
              <span
                title="Instagram fraco — presença social mapeada parcial ou inexistente"
                className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary-soft px-2 py-0.5 text-[10.5px] font-medium text-primary"
              >
                <Share2 className="h-3 w-3" aria-hidden />
                {socialStrength === "none" ? "Sem redes" : "Redes fracas"}
              </span>
            )}
            {isFeatureEnabled("v2ScoringInDiscovery") && result.opportunityConfidence != null && (
              <ConfidenceBadge confidence={result.opportunityConfidence} />
            )}
            {enrichmentStatus != null &&
              (enrichmentStatus !== "failed" || isFeatureEnabled("v2ScoringInDiscovery")) && (
                <EnrichmentStatusBadge state={enrichmentStatus} />
              )}
          </div>

          {/* SÓ o card selecionado ganha a linha de ações — ícones circulares
           * (mockup). A11y: cada círculo tem aria-label próprio; pointer-events
           * reativado para não ficarem sob o botão de seleção do card. */}
          {isFocused && (
            <div className="pointer-events-auto mt-2 flex items-center gap-1.5">
              <CircleBtn
                onClick={(e) => {
                  e.stopPropagation();
                  void openWhats();
                }}
                disabled={!hasContact}
                ariaLabel="Enviar WhatsApp"
                title={hasContact ? "WhatsApp" : "Sem celular para WhatsApp"}
              >
                <MessageCircle className="h-3.5 w-3.5" />
              </CircleBtn>
              <CircleBtn
                onClick={(e) => {
                  e.stopPropagation();
                  if (result.phone) window.open(`tel:${result.phone}`);
                }}
                disabled={!result.phone}
                ariaLabel="Ligar"
                title={result.phone ? "Ligar" : "Sem telefone"}
              >
                <Phone className="h-3.5 w-3.5" />
              </CircleBtn>
              {result.instagram ? (
                <a
                  href={`https://instagram.com/${result.instagram.replace("@", "")}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Abrir Instagram"
                  title="Instagram"
                  className="grid h-8 w-8 place-items-center rounded-full border border-border bg-surface text-foreground transition-colors hover:border-border-strong"
                >
                  <Instagram className="h-3.5 w-3.5" />
                </a>
              ) : (
                <CircleBtn disabled ariaLabel="Instagram indisponível" title="Sem Instagram">
                  <Instagram className="h-3.5 w-3.5" />
                </CircleBtn>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
});

/** Botão circular de ação (h-8 w-8) — só existe no card SELECIONADO. */
function CircleBtn({
  children,
  onClick,
  disabled,
  ariaLabel,
  title,
}: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  ariaLabel: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
      className="grid h-8 w-8 place-items-center rounded-full border border-border bg-surface text-foreground transition-colors hover:border-border-strong disabled:opacity-40"
    >
      {children}
    </button>
  );
}
