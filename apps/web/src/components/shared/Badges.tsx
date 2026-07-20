import { cn } from "@/lib/utils";
import type { LeadTemperature } from "@/types";
import { TEMPERATURE_LABELS } from "@/lib/constants";
import { Flame, Thermometer, Snowflake } from "lucide-react";

const map: Record<LeadTemperature, { cls: string; icon: React.ElementType }> = {
  hot: { cls: "bg-hot text-hot-foreground", icon: Flame },
  warm: { cls: "bg-warm text-warm-foreground", icon: Thermometer },
  cold: { cls: "bg-cold text-cold-foreground", icon: Snowflake },
};

export function TemperatureBadge({
  temperature,
  size = "sm",
}: {
  temperature: LeadTemperature;
  size?: "xs" | "sm";
}) {
  const { cls, icon: Icon } = map[temperature];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md font-medium",
        cls,
        size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
      )}
    >
      <Icon className={size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3"} />
      {TEMPERATURE_LABELS[temperature]}
    </span>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 75 ? "text-hot" : score >= 45 ? "text-warm-foreground" : "text-muted-foreground";
  return <span className={cn("font-mono text-sm font-semibold tabular-nums", color)}>{score}</span>;
}
