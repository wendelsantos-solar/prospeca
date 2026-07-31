import { MapPin, Star, TrendingUp } from "lucide-react";
import { MarketingSection, MarketingContainer, SectionHeading } from "./MarketingLayout";
import { DEMO_LEADS, PIPELINE_STAGES } from "@/marketing/demo-data";
import { cn } from "@/lib/utils";

export function PipelineSection() {
  const stageLeads = {
    new: DEMO_LEADS.filter((l) => l.stage === "new").slice(0, 2),
    qualified: DEMO_LEADS.filter((l) => l.stage === "qualified").slice(0, 2),
    contacted: DEMO_LEADS.filter((l) => l.stage === "contacted").slice(0, 2),
    won: DEMO_LEADS.filter((l) => l.stage === "won").slice(0, 1),
    discarded: DEMO_LEADS.filter((l) => l.stage === "discarded").slice(0, 1),
  };
  const stageColors: Record<string, { bg: string; badge: string; text: string }> = {
    new: {
      bg: "bg-stage-new-soft",
      badge: "bg-stage-new text-stage-new-foreground",
      text: "text-stage-new",
    },
    qualified: {
      bg: "bg-stage-qualified-soft",
      badge: "bg-stage-qualified text-stage-qualified-foreground",
      text: "text-stage-qualified",
    },
    contacted: {
      bg: "bg-stage-contacted-soft",
      badge: "bg-stage-contacted text-stage-contacted-foreground",
      text: "text-stage-contacted",
    },
    won: {
      bg: "bg-stage-won-soft",
      badge: "bg-stage-won text-stage-won-foreground",
      text: "text-stage-won",
    },
    discarded: {
      bg: "bg-stage-discarded-soft",
      badge: "bg-stage-discarded text-stage-discarded-foreground",
      text: "text-stage-discarded",
    },
  };
  return (
    <MarketingSection spacing="lg">
      <MarketingContainer width="wide">
        <SectionHeading
          eyebrow="Pipeline"
          title="Da descoberta ao fechamento, sem perder o contexto."
          center
        />
        <div className="mt-12 grid gap-3 md:grid-cols-5">
          {PIPELINE_STAGES.map((stage) => {
            const color = stageColors[stage.key];
            const leads = stageLeads[stage.key as keyof typeof stageLeads] ?? [];
            return (
              <div
                key={stage.key}
                className={cn("flex flex-col rounded-xl border border-border p-3", color.bg)}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className={cn("text-xs font-semibold", color.text)}>{stage.label}</span>
                  <span
                    className={cn(
                      "grid h-5 min-w-[1.25rem] place-items-center rounded-full px-1.5 text-[10px] font-bold",
                      color.badge,
                    )}
                  >
                    {stage.count}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {leads.map((lead) => (
                    <div
                      key={lead.id}
                      className="rounded-lg border border-border bg-surface p-2.5 shadow-card transition-colors hover:border-primary/20"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-xs font-semibold text-foreground leading-tight">
                          {lead.companyName}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold",
                            lead.temperature === "hot" && "bg-hot-soft text-hot",
                            lead.temperature === "warm" && "bg-warm-soft text-warm",
                            lead.temperature === "cold" && "bg-cold-soft text-cold",
                          )}
                        >
                          {lead.score}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-0.5">
                          <MapPin className="h-2.5 w-2.5" /> {lead.distanceKm} km
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Star className="h-2.5 w-2.5" /> {lead.rating}
                        </span>
                        {!lead.hasWebsite && (
                          <span className="flex items-center gap-0.5 text-primary font-medium">
                            <TrendingUp className="h-2.5 w-2.5" /> Sem site
                          </span>
                        )}
                      </div>
                      {lead.nextAction && (
                        <div className="mt-2 border-t border-border pt-1.5 text-[10px] text-muted-foreground">
                          <span className="font-medium text-foreground">Próxima:</span>{" "}
                          {lead.nextAction}
                        </div>
                      )}
                    </div>
                  ))}
                  {leads.length === 0 && (
                    <div className="grid h-16 place-items-center rounded-lg border border-dashed border-border text-[10px] text-muted-foreground">
                      Vazio
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Arraste leads entre estágios, defina próximas ações e acompanhe cada oportunidade até a
          conversão.
        </p>
      </MarketingContainer>
    </MarketingSection>
  );
}
