import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import { AppIcon } from "@/design-system/icons/AppIcon";
import { icons } from "@/design-system/icons/icon-registry";

interface SummaryRow {
  key: string;
  value: string;
  hasRealData: boolean;
}

interface PersonalizationSummaryProps {
  rows: SummaryRow[];
}

export function PersonalizationSummary({ rows }: PersonalizationSummaryProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center justify-between"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <Label className="cursor-pointer text-xs">Resumo da personalização</Label>
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded ? "" : "-rotate-90"}`}
        />
      </button>
      {expanded && (
        <div className="mt-1.5 rounded-lg border p-3">
          {rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhuma variável usada nesse modelo ainda.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {rows.map((row) => (
                <div key={row.key} className="flex items-center gap-1.5 text-xs">
                  {row.hasRealData ? (
                    <AppIcon icon={icons.feedback.success} size="xs" tone="success" decorative />
                  ) : (
                    <AppIcon icon={icons.pipeline.circle} size="xs" tone="warning" decorative />
                  )}
                  <span className="font-mono text-muted-foreground">{`{{${row.key}}}`}</span>
                  <span className="truncate font-medium">→ {row.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
