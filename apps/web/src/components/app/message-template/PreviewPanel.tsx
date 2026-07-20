import { Info, CheckCircle2, Circle } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { useLeadsStore } from "@/stores";
import { ConversationPreview } from "./ConversationPreview";
import { PersonalizationSummary } from "./PersonalizationSummary";

type Lead = ReturnType<typeof useLeadsStore.getState>["leads"][number];

interface PreviewPanelProps {
  leads: Lead[];
  testLead: Lead | null;
  testLeadIndex: number;
  onTestLeadChange: (index: number) => void;
  dataMode: "real" | "missing";
  onDataModeChange: (mode: "real" | "missing") => void;
  switching: boolean;
  contactName: string;
  message: string;
  time: string;
  summaryRows: { key: string; value: string; hasRealData: boolean }[];
}

function PreviewSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-xl border shadow-sm">
      <div className="h-14 bg-muted" />
      <div className="min-h-[220px] space-y-2 bg-muted/40 p-4">
        <div className="ml-auto h-16 w-2/3 rounded-lg bg-muted" />
      </div>
      <div className="h-11 bg-muted" />
    </div>
  );
}

export function PreviewPanel({
  leads,
  testLeadIndex,
  onTestLeadChange,
  dataMode,
  onDataModeChange,
  switching,
  contactName,
  message,
  time,
  summaryRows,
}: PreviewPanelProps) {
  return (
    <div className="grid gap-4">
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Label className="text-xs">Pré-visualização</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Info className="h-3 w-3 text-muted-foreground" />
                </span>
              </TooltipTrigger>
              <TooltipContent>Simula como a mensagem aparece no WhatsApp do lead</TooltipContent>
            </Tooltip>
          </div>
          {leads.length > 0 && (
            <Select
              value={String(testLeadIndex % leads.length)}
              onValueChange={(v) => onTestLeadChange(Number(v))}
            >
              <SelectTrigger
                aria-label="Testar com outro lead"
                className="h-7 w-auto gap-1 border-none px-2 text-[11px] shadow-none"
              >
                <SelectValue placeholder="Testar com outro lead" />
              </SelectTrigger>
              <SelectContent align="end">
                {leads.map((l, i) => (
                  <SelectItem key={l.id} value={String(i)}>
                    {l.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div
          className="mt-1.5 grid grid-cols-2 gap-1 rounded-lg border bg-muted/40 p-1 text-xs"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={dataMode === "real"}
            className={`flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              dataMode === "real"
                ? "bg-background text-emerald-700 shadow-sm dark:text-emerald-400"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onDataModeChange("real")}
          >
            {dataMode === "real" ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <Circle className="h-3.5 w-3.5" />
            )}
            Dados reais
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={dataMode === "missing"}
            className={`flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              dataMode === "missing"
                ? "bg-background text-amber-700 shadow-sm dark:text-amber-400"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onDataModeChange("missing")}
          >
            {dataMode === "missing" ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <Circle className="h-3.5 w-3.5" />
            )}
            Campos ausentes
          </button>
        </div>

        <div className="mt-2">
          {switching ? (
            <PreviewSkeleton />
          ) : (
            <ConversationPreview contactName={contactName} message={message} time={time} />
          )}
        </div>
      </div>

      <PersonalizationSummary rows={summaryRows} />
    </div>
  );
}
