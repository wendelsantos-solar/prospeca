import { cn } from "@/lib/utils";
import type { LeadTemperature } from "@/types";
import { TEMPERATURE_LABELS } from "@/lib/constants";
import { confidenceBandFromConfidence, type ConfidenceBand } from "@leads/domain";
import { AppIcon } from "@/design-system/icons/AppIcon";
import { icons } from "@/design-system/icons/icon-registry";
import type { LucideIcon } from "lucide-react";

// ── Atomos de temperatura (anel de score + pill) — fonte única para cards e
// detalhe. Antes viviam em DiscoveryCard (P3 do Ateliê: atoms não moram em
// componente de card). ───────────────────────────────────────────────

export const TEMP_META: Record<LeadTemperature, { label: string; ring: string; badge: string }> = {
  hot: { label: "Quente", ring: "var(--color-hot)", badge: "bg-hot-soft text-hot" },
  warm: { label: "Morno", ring: "var(--color-warm)", badge: "bg-warm-soft text-warm" },
  cold: { label: "Frio", ring: "var(--color-cold)", badge: "bg-cold-soft text-cold" },
};

/** Score em anel cônico preenchido até `score`%, tingido pela temperatura.
 * A temperatura nunca é comunicada só por cor — o número é sempre legível no
 * centro e o badge/pill a repete como texto. */
export function ScoreRing({
  score,
  temperature,
  size = "lg",
}: {
  score: number;
  temperature: LeadTemperature;
  /** sm=h-9 · md=h-10 (card do mockup) · lg=h-11 (header do detalhe). */
  size?: "sm" | "md" | "lg";
}) {
  const color = TEMP_META[temperature].ring;
  const box = size === "sm" ? "h-9 w-9" : size === "md" ? "h-10 w-10" : "h-11 w-11";
  const text = size === "sm" ? "text-[11px]" : size === "md" ? "text-[12px]" : "text-[13px]";
  return (
    <div
      className={cn("relative grid shrink-0 place-items-center rounded-full", box)}
      style={{
        background: `conic-gradient(${color} ${Math.max(0, Math.min(100, score))}%, var(--color-border) 0)`,
      }}
      aria-hidden
    >
      <div className="absolute inset-[3px] rounded-full bg-surface" />
      <span className={cn("relative z-10 font-mono font-bold tabular-nums text-foreground", text)}>
        {score}
      </span>
    </div>
  );
}

/** Pill de temperatura com ponto — o mesmo badge do card de descoberta, usado
 * também no header do detalhe. */
export function TemperaturePill({ temperature }: { temperature: LeadTemperature }) {
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

const map: Record<LeadTemperature, { cls: string; icon: LucideIcon }> = {
  hot: { cls: "bg-hot-soft text-hot", icon: icons.lead.hot },
  warm: { cls: "bg-warm-soft text-warm", icon: icons.lead.warm },
  cold: { cls: "bg-cold-soft text-cold", icon: icons.lead.cold },
};

export function TemperatureBadge({
  temperature,
  size = "sm",
}: {
  temperature: LeadTemperature;
  size?: "xs" | "sm";
}) {
  const { cls, icon } = map[temperature];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md font-medium",
        cls,
        size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
      )}
    >
      <AppIcon icon={icon} size="xs" tone="inherit" decorative />
      {TEMPERATURE_LABELS[temperature]}
    </span>
  );
}

/**
 * Compact score pill used in the lead drawer header — merges temperature (icon)
 * and score (number) into a single badge, colored by score band.
 */
export function ScorePill({
  score,
  temperature,
  className,
}: {
  score: number;
  temperature: LeadTemperature;
  className?: string;
}) {
  const { icon } = map[temperature];
  const tone =
    score >= 75
      ? "bg-primary-hover text-primary-foreground"
      : score >= 45
        ? "bg-warm text-warm-foreground"
        : "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
        tone,
        className,
      )}
    >
      <AppIcon icon={icon} size="xs" tone="inherit" decorative />
      {score}
    </span>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 75 ? "text-hot" : score >= 45 ? "text-warm-foreground" : "text-muted-foreground";
  return <span className={cn("font-mono text-sm font-semibold tabular-nums", color)}>{score}</span>;
}

// ── V2 opportunity-score confidence band ────────────────────────────────────

const CONFIDENCE_LABELS: Record<ConfidenceBand, string> = {
  low: "confiança baixa",
  medium: "confiança média",
  high: "confiança alta",
};

const CONFIDENCE_STYLES: Record<ConfidenceBand, string> = {
  low: "border-dashed border-border text-muted-foreground",
  medium: "border-border bg-muted/60 text-muted-foreground",
  high: "border-primary/30 bg-primary-soft text-primary",
};

/**
 * Confidence band badge for the V2 opportunity score (LOW < 0.70 ·
 * MEDIUM 0.70–0.84 · HIGH ≥ 0.85 — thresholds live in @leads/domain).
 * Rendered next to the "provisório" state in the discovery list.
 */
export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const band = confidenceBandFromConfidence(confidence);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
        CONFIDENCE_STYLES[band],
      )}
      title={`Confiança do score: ${Math.round(confidence * 100)}%`}
    >
      {CONFIDENCE_LABELS[band]}
    </span>
  );
}
