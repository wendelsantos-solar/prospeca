import { MapPin, Star, Phone, TrendingUp, GitBranch, Search, MessageCircle } from "lucide-react";
import { DEMO_LEADS, DEMO_SEARCH, PIPELINE_STAGES } from "@/marketing/demo-data";
import { cn } from "@/lib/utils";

/**
 * Hero product demo — coded composition of real product surfaces.
 * Mirrors actual UI structure from the authenticated application:
 * search bar → map with markers → opportunity card → pipeline strip.
 */
export function HeroProductDemo() {
  const hotLead = DEMO_LEADS[0]; // Rústica Barbearia — Score 89

  return (
    <div className="relative rounded-2xl border border-border bg-surface p-3 shadow-elevated md:p-4">
      {/* Browser chrome */}
      <div className="mb-3 flex items-center gap-1.5 px-1">
        <div className="h-2.5 w-2.5 rounded-full bg-stage-discarded/40" />
        <div className="h-2.5 w-2.5 rounded-full bg-stage-qualified/40" />
        <div className="h-2.5 w-2.5 rounded-full bg-stage-new/40" />
        <div className="ml-2 flex-1 rounded-md bg-surface-2 px-3 py-1.5 text-[11px] text-muted-foreground">
          app.radarlocal.com
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
        {/* Left: Map + search */}
        <div className="rounded-xl border border-border bg-surface-2 p-3">
          {/* Search bar */}
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground">{DEMO_SEARCH.niche}</span>
              {" · "}
              {DEMO_SEARCH.location}
              {" · "}
              {DEMO_SEARCH.radiusKm} km
            </span>
            <span className="ml-auto shrink-0 rounded bg-primary-soft px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {DEMO_SEARCH.resultsCount}
            </span>
          </div>

          {/* Map */}
          <div className="relative h-48 overflow-hidden rounded-lg bg-[oklch(0.955_0.012_156)] md:h-56">
            {/* Grid pattern for map texture */}
            <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle,_var(--border)_1px,_transparent_1px)] [background-size:20px_20px]" />

            {/* Roads (stylized) */}
            <div className="absolute left-0 top-[30%] h-[2px] w-full bg-border/60" />
            <div className="absolute left-0 top-[55%] h-[2px] w-full bg-border/60" />
            <div className="absolute left-[35%] top-0 h-full w-[2px] bg-border/60" />
            <div className="absolute left-[65%] top-0 h-full w-[2px] bg-border/60" />

            {/* Radius circle */}
            <div className="absolute left-[42%] top-[42%] h-[60%] w-[55%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary/20 bg-primary-subtle/30" />

            {/* Center point */}
            <div className="absolute left-[42%] top-[42%] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow" />

            {/* Lead markers with scores */}
            {[
              { top: "30%", left: "48%", score: 89, temp: "hot" as const },
              { top: "52%", left: "60%", score: 76, temp: "warm" as const },
              { top: "38%", left: "32%", score: 64, temp: "warm" as const },
              { top: "58%", left: "28%", score: 55, temp: "cold" as const },
              { top: "46%", left: "68%", score: 81, temp: "hot" as const },
            ].map((pin, i) => (
              <div
                key={i}
                className={cn(
                  "absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[10px] font-bold shadow",
                  pin.temp === "hot" && "bg-hot text-hot-foreground animate-pulse-soft",
                  pin.temp === "warm" && "bg-warm text-warm-foreground animate-float",
                  pin.temp === "cold" && "bg-cold text-cold-foreground",
                )}
                style={{
                  top: pin.top,
                  left: pin.left,
                  animationDelay: `${i * 0.5}s`,
                }}
              >
                {pin.score}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Opportunity card + pipeline */}
        <div className="flex flex-col gap-3">
          {/* Opportunity card */}
          <div
            className="animate-slide-up rounded-xl border border-primary/20 bg-surface p-3 shadow-card"
            style={{ animationDelay: "0.2s" }}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">{hotLead.companyName}</span>
              <span className="rounded-md bg-hot-soft px-2 py-0.5 text-xs font-semibold text-hot">
                Score {hotLead.score}
              </span>
            </div>
            <p className="mb-2 text-[11px] font-medium text-muted-foreground">
              Alta oportunidade porque:
            </p>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <TrendingUp className="h-3 w-3 shrink-0 text-primary" />
                Não possui site
              </li>
              <li className="flex items-center gap-1.5">
                <Star className="h-3 w-3 shrink-0 text-primary" />
                Avaliação {hotLead.rating} · {hotLead.reviewCount} avaliações
              </li>
              <li className="flex items-center gap-1.5">
                <Phone className="h-3 w-3 shrink-0 text-primary" />
                Telefone e WhatsApp encontrados
              </li>
              <li className="flex items-center gap-1.5">
                <MapPin className="h-3 w-3 shrink-0 text-primary" />A {hotLead.distanceKm} km de
                distância
              </li>
            </ul>
          </div>

          {/* Pipeline strip */}
          <div
            className="animate-slide-up rounded-xl border border-border bg-surface p-3"
            style={{ animationDelay: "0.35s" }}
          >
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <GitBranch className="h-3 w-3" /> Pipeline
            </div>
            <div className="flex gap-1.5 text-[11px]">
              {PIPELINE_STAGES.slice(0, 4).map((stage) => (
                <div
                  key={stage.key}
                  className={cn(
                    "flex-1 rounded-md p-2 text-center",
                    stage.key === "won" ? "bg-stage-won-soft" : "bg-surface-2",
                  )}
                >
                  <div className="font-semibold text-foreground">{stage.count}</div>
                  <div className="text-muted-foreground">{stage.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Message preview hint */}
          <div
            className="animate-slide-up rounded-lg border border-border bg-surface-2 p-2.5 text-[11px] text-muted-foreground"
            style={{ animationDelay: "0.5s" }}
          >
            <div className="mb-1 flex items-center gap-1.5">
              <MessageCircle className="h-3 w-3 text-primary" />
              <span className="font-medium text-foreground">Mensagem pronta</span>
            </div>
            <p className="leading-relaxed">
              Oi {hotLead.contactName}! Vi que a{" "}
              <span className="font-medium text-foreground">{hotLead.companyName}</span> ainda não
              tem site...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
