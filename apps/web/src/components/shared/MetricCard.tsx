import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, Info } from "lucide-react";

export function MetricCard({
  label,
  value,
  delta,
  tooltip,
  accent,
}: {
  label: string;
  value: string;
  delta?: number | null;
  tooltip?: string;
  accent?: "primary" | "hot" | "warm" | "cold" | "success" | "info";
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <Card className="border-border/70 shadow-elegant">
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            {label}
            {tooltip && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground/70" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </span>
          {delta != null && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold",
                up ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
              )}
            >
              {up ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
              {Math.abs(delta).toFixed(1)}%
            </span>
          )}
        </div>
        <div
          className={cn(
            "mt-2 text-2xl font-semibold tabular-nums",
            accent === "hot" && "text-hot",
            accent === "success" && "text-success",
          )}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
