import {
  MapPin,
  Star,
  Phone,
  TrendingUp,
  GitBranch,
  Search,
  MessageCircle,
  RefreshCw,
  Crosshair,
  ZoomIn,
  Circle as CircleIcon,
  Moon,
  Info,
  ChevronUp,
} from "lucide-react";
import { DEMO_LEADS, DEMO_SEARCH, PIPELINE_STAGES } from "@/marketing/demo-data";
import { cn } from "@/lib/utils";

// Mirrors markerColor()/markerVisual() in components/app/map-popup.ts
const MARKER_HEX = { hot: "#f97316", warm: "#eab308", cold: "#64748b", funnel: "#16a34a" };

const MAP_PINS = [
  { top: "22%", left: "46%", score: 89, temp: "hot" as const },
  { top: "58%", left: "62%", score: 76, temp: "warm" as const },
  { top: "40%", left: "24%", score: 81, temp: "hot" as const },
  { top: "70%", left: "38%", score: 55, temp: "cold" as const },
];
const MAP_CLUSTERS = [
  { top: "34%", left: "70%", count: 8 },
  { top: "66%", left: "18%", count: 5 },
];

/**
 * Hero product demo — coded composition of real product surfaces.
 * Mirrors actual UI structure from the authenticated application:
 * search bar → map with markers → opportunity card → pipeline strip.
 */
export function HeroProductDemo() {
  const hotLead = DEMO_LEADS[0]; // Rústica Barbearia — Score 89
  const secondLead = DEMO_LEADS[2]; // Studio Aurora — used for the second activity card

  return (
    <div className="relative rounded-2xl border border-border bg-surface p-3 shadow-elevated md:p-4">
      {/* Browser chrome */}
      <div className="mb-3 flex items-center gap-1.5 px-1">
        <div className="h-2.5 w-2.5 rounded-full bg-stage-discarded/40" />
        <div className="h-2.5 w-2.5 rounded-full bg-stage-qualified/40" />
        <div className="h-2.5 w-2.5 rounded-full bg-stage-new/40" />
        <div className="ml-2 flex-1 rounded-md bg-surface-2 px-3 py-1.5 text-[11px] text-muted-foreground">
          app.prospeca.com.br
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
          <div className="relative h-48 overflow-hidden rounded-lg bg-[oklch(0.965_0.01_140)] md:h-56">
            {/* Terrain */}
            <div className="absolute -left-6 -top-8 h-28 w-32 rounded-[45%] bg-[oklch(0.93_0.03_140)]" />
            <div className="absolute -bottom-10 -right-10 h-32 w-40 rounded-[40%] bg-[oklch(0.92_0.03_230)]" />

            {/* Roads (stylized, off-grid) */}
            <div className="absolute left-0 top-[26%] h-[2px] w-full -rotate-[3deg] bg-border/70" />
            <div className="absolute left-0 top-[62%] h-[2px] w-full rotate-[2deg] bg-border/70" />
            <div className="absolute left-[40%] top-0 h-full w-[2px] rotate-[6deg] bg-border/70" />
            <div className="absolute left-[72%] top-0 h-full w-[2px] -rotate-[4deg] bg-border/70" />

            {/* Radius circle */}
            <div className="absolute left-[46%] top-[48%] h-[65%] w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary/20 bg-primary-subtle/20" />

            {/* Center point (searched address) */}
            <div className="absolute left-[46%] top-[48%] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow" />

            {/* Individual lead pins — mirrors markerVisual() in map-popup.ts */}
            {MAP_PINS.map((pin, i) => (
              <div
                key={i}
                className="absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[9px] font-bold text-white shadow"
                style={{
                  top: pin.top,
                  left: pin.left,
                  background: MARKER_HEX[pin.temp],
                  border: "2px solid #ffffff",
                }}
              >
                {pin.score}
              </div>
            ))}

            {/* Cluster badges — flat green, count-only, like the real clusterer */}
            {MAP_CLUSTERS.map((c, i) => (
              <div
                key={i}
                className="absolute grid h-[26px] w-[26px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[10px] font-bold text-white shadow"
                style={{
                  top: c.top,
                  left: c.left,
                  background: MARKER_HEX.funnel,
                  border: "2px solid #ffffff",
                }}
              >
                {c.count}
              </div>
            ))}

            {/* Results pill — mirrors "X de Y no raio" */}
            <div className="absolute left-1/2 top-2 -translate-x-1/2 rounded-lg border border-border bg-surface/95 px-2.5 py-1 text-[10px] font-medium shadow-elevated backdrop-blur">
              {MAP_PINS.length + MAP_CLUSTERS.reduce((n, c) => n + c.count, 0)}{" "}
              <span className="text-muted-foreground">de {DEMO_SEARCH.resultsCount} no raio</span>
            </div>

            {/* Consolidated control box */}
            <div className="absolute right-2 top-2 flex flex-col gap-0.5 rounded-lg border border-border bg-surface/95 p-1 shadow-elevated backdrop-blur">
              {[RefreshCw, Crosshair, ZoomIn].map((Icon, i) => (
                <div
                  key={i}
                  className="grid h-6 w-6 place-items-center rounded text-muted-foreground"
                >
                  <Icon className="h-3 w-3" />
                </div>
              ))}
              <div className="my-0.5 h-px bg-border" />
              <div className="grid h-6 w-6 place-items-center rounded bg-primary text-primary-foreground">
                <CircleIcon className="h-3 w-3" />
              </div>
              <div className="grid h-6 w-6 place-items-center rounded text-muted-foreground">
                <Moon className="h-3 w-3" />
              </div>
            </div>

            {/* Collapsible legend — shown collapsed, like the real default */}
            <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-lg border border-border bg-surface/95 px-2 py-1 text-[9px] font-medium text-muted-foreground shadow-elevated backdrop-blur">
              <Info className="h-2.5 w-2.5" />
              Legenda
              <ChevronUp className="h-2.5 w-2.5" />
            </div>
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

          {/* Illustrative activity — two stacked example cards, no fake timestamps */}
          <div className="relative">
            <div
              className="animate-slide-up absolute inset-x-2 -top-2 -rotate-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[11px] opacity-80 shadow-card"
              style={{ animationDelay: "0.6s" }}
            >
              <div className="flex items-center gap-2">
                <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                  <MessageCircle className="h-3.5 w-3.5" />
                </div>
                <div>
                  <span className="font-medium text-foreground">Abordagem pronta</span>
                  <span className="text-muted-foreground"> · {secondLead.companyName}</span>
                </div>
              </div>
            </div>
            <div
              className="animate-slide-up relative flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-[11px] shadow-card"
              style={{ animationDelay: "0.65s" }}
            >
              <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-hot-soft text-hot">
                <TrendingUp className="h-3.5 w-3.5" />
              </div>
              <div>
                <span className="font-medium text-foreground">Nova empresa encontrada</span>
                <span className="text-muted-foreground">
                  {" "}
                  · Score {hotLead.score} — {hotLead.companyName}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
