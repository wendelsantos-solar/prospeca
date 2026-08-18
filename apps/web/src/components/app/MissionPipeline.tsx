import { useMemo, useState } from "react";
import { Check, ChevronDown, Circle, Loader2, X } from "lucide-react";
import {
  derivePipeline,
  type MissionPipelineInput as DomainPipelineInput,
  type PipelineStepState,
} from "@leads/domain";
import { useMissionPipeline, useDiscoveryResults } from "@/hooks/useLeadsQuery";
import { useLeadsStore } from "@/stores";
import { cn } from "@/lib/utils";

const STATE_ICON: Record<PipelineStepState, React.ReactNode> = {
  done: <Check className="h-3 w-3 text-primary" />,
  running: <Loader2 className="h-3 w-3 animate-spin text-primary" />,
  waiting: <Circle className="h-3 w-3 text-muted-foreground/50" />,
  failed: <X className="h-3 w-3 text-destructive" />,
};

/** Real per-source state counts across the mission's places (V3-B). */
function countSources(sources: Array<{ placeId: string; sources: Record<string, unknown> }>): {
  website: { done: number; running: number; failed: number };
  registry: { done: number; running: number; failed: number };
} {
  const out = {
    website: { done: 0, running: 0, failed: 0 },
    registry: { done: 0, running: 0, failed: 0 },
  };
  for (const row of sources) {
    for (const key of ["website", "business_registry"] as const) {
      const s = (row.sources[key] as { status?: string } | undefined)?.status;
      if (!s) continue;
      const bucket = key === "website" ? out.website : out.registry;
      if (s === "enriched") bucket.done++;
      else if (s === "processing") bucket.running++;
      else if (s === "failed") bucket.failed++;
      // partial counts toward done (checked with gaps) — honest enough
      else if (s === "partial") bucket.done++;
    }
  }
  return out;
}

function jobCounts(
  jobs: Array<{ placeId: string | null; type: string; status: string }>,
): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const j of jobs) {
    const byStatus = (out[j.type] ??= {});
    byStatus[j.status] = (byStatus[j.status] ?? 0) + 1;
  }
  return out;
}

/** Task-queue counters per real task type — no fabricated numbers (V3-B). */
function taskLines(
  jobs: Array<{ placeId: string | null; type: string; status: string }>,
  sources: ReturnType<typeof countSources>,
): Array<{ label: string; text: string }> {
  const counts = jobCounts(jobs);
  const lines: Array<{ label: string; text: string }> = [];
  const scoring = counts["OPPORTUNITY_SCORING"] ?? {};
  lines.push({
    label: "Score",
    text: `✓${scoring["completed"] ?? 0}${scoring["failed"] ? ` ✗${scoring["failed"]}` : ""}${
      (scoring["processing"] ?? 0) + (scoring["retrying"] ?? 0) + (scoring["queued"] ?? 0) > 0
        ? ` ⟳${(scoring["processing"] ?? 0) + (scoring["retrying"] ?? 0) + (scoring["queued"] ?? 0)}`
        : ""
    }`,
  });
  const territory = counts["TERRITORY_ANALYSIS"] ?? {};
  lines.push({
    label: "Território",
    text: `✓${territory["completed"] ?? 0}${territory["failed"] ? ` ✗${territory["failed"]}` : ""}`,
  });
  const w = sources.website;
  lines.push({
    label: "Website",
    text: `✓${w.done}${w.running ? ` ⟳${w.running}` : ""}${w.failed ? ` ✗${w.failed}` : ""}`,
  });
  const r = sources.registry;
  lines.push({
    label: "CNPJ",
    text:
      r.done + r.running + r.failed === 0
        ? "sob consulta"
        : `✓${r.done}${r.running ? ` ⟳${r.running}` : ""}${r.failed ? ` ✗${r.failed}` : ""}`,
  });
  return lines;
}

/**
 * Mission pipeline (V3-B) — the four processing stages with ✓/⟳/○/✗ derived
 * from REAL data (searches.status, jobs counts, enrichment_sources). No fake
 * progress: empty data shows "aguardando"/"sob consulta".
 */
export function MissionPipeline({ searchId }: { searchId: string }) {
  const currentSearch = useLeadsStore((s) => s.currentSearch);
  const { data: pipelineData } = useMissionPipeline(searchId);
  const { data: discovery } = useDiscoveryResults(searchId);
  // P3 do Ateliê: a faixa COLAPSA quando a missão está concluída (todos os
  // passos done) — libera altura para o mapa. O usuário expande se quiser;
  // enquanto há algo rodando/falhando ela fica aberta por padrão.
  const [userCollapsed, setUserCollapsed] = useState<boolean | null>(null);

  const steps = useMemo(() => {
    const input: DomainPipelineInput = {
      // The store's currentSearch doesn't carry the row status; derive
      // honestly from observable data: results exist → the search completed.
      searchStatus: (discovery?.length ?? 0) > 0 ? "completed" : null,
      foundCount: currentSearch?.totalFound ?? 0,
      totalPlaces: discovery?.length ?? 0,
      jobCounts: jobCounts(pipelineData?.jobs ?? []),
      sourceCounts: countSources(
        (pipelineData?.sources ?? []) as Array<{
          placeId: string;
          sources: Record<string, unknown>;
        }>,
      ),
    };
    return derivePipeline(input);
  }, [pipelineData, discovery, currentSearch]);

  const lines = useMemo(
    () =>
      taskLines(
        pipelineData?.jobs ?? [],
        countSources(
          (pipelineData?.sources ?? []) as Array<{
            placeId: string;
            sources: Record<string, unknown>;
          }>,
        ),
      ),
    [pipelineData],
  );

  const allDone = steps.length > 0 && steps.every((s) => s.state === "done");
  const collapsed = userCollapsed ?? allDone;

  return (
    <div className="rounded-lg border border-border bg-surface/60 px-3 py-2">
      <button
        type="button"
        onClick={() => setUserCollapsed(!collapsed)}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Expandir detalhes da missão" : "Recolher detalhes da missão"}
        className="flex w-full items-center justify-between gap-2"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {steps.map((step) => (
            <span
              key={step.key}
              className="flex items-center gap-1 text-[11px] font-medium text-foreground"
            >
              <span className="grid h-4 w-4 shrink-0 place-items-center">
                {STATE_ICON[step.state]}
              </span>
              <span className={cn("truncate", collapsed && "hidden sm:inline")}>{step.label}</span>
            </span>
          ))}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            !collapsed && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {!collapsed && (
        <>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-4">
            {steps.map((step) => (
              <div key={step.key} className="flex items-center gap-1.5">
                <span className="grid h-4 w-4 shrink-0 place-items-center">
                  {STATE_ICON[step.state]}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-medium text-foreground">{step.label}</p>
                  <p
                    className={cn(
                      "truncate text-[10px]",
                      step.state === "failed" ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {step.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-border/60 pt-1.5">
            {lines.map((l) => (
              <span key={l.label} className="text-[10.5px] tabular-nums text-muted-foreground">
                <span className="font-medium text-foreground">{l.label}</span> {l.text}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
