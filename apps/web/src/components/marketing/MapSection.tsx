import { MapPin, Navigation, Layers, Eye, Target } from "lucide-react";
import { MarketingSection, MarketingContainer, SectionHeading } from "./MarketingLayout";
import { DEMO_LEADS } from "@/marketing/demo-data";
import { cn } from "@/lib/utils";

const BENEFITS = [
  {
    icon: Eye,
    label: "Visualize concentrações",
    description: "Veja onde as oportunidades se agrupam por região.",
  },
  {
    icon: Target,
    label: "Priorize por proximidade",
    description: "Distância real entre você e cada lead no mapa.",
  },
  {
    icon: Layers,
    label: "Explore bairros inteiros",
    description: "Um raio de busca cobre dezenas de estabelecimentos.",
  },
  {
    icon: Navigation,
    label: "Identifique áreas novas",
    description: "Descubra regiões ainda pouco trabalhadas.",
  },
];

export function MapSection() {
  return (
    <MarketingSection muted spacing="lg">
      <MarketingContainer width="wide">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <SectionHeading
              eyebrow="Descubra"
              title={
                <>
                  Veja no mapa onde estão
                  <br />
                  suas próximas oportunidades
                </>
              }
              description="Empresas encontradas aparecem no mapa com o score visível. Filtre por região e priorize por distância real."
            />
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {BENEFITS.map((b) => (
                <div
                  key={b.label}
                  className="flex gap-3 rounded-lg border border-border bg-surface p-3"
                >
                  <b.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{b.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{b.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative overflow-hidden rounded-xl border border-border bg-surface shadow-card">
            <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
              <div className="h-2 w-2 rounded-full bg-stage-discarded/40" />
              <div className="h-2 w-2 rounded-full bg-stage-qualified/40" />
              <div className="h-2 w-2 rounded-full bg-stage-new/40" />
              <div className="ml-2 text-[10px] text-muted-foreground">Mapa · Barbearia</div>
            </div>
            <div className="relative h-80 bg-[oklch(0.955_0.012_156)] md:h-96">
              <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle,_var(--border)_1px,_transparent_1px)] [background-size:22px_22px]" />
              <div className="absolute left-0 top-[28%] h-px w-full bg-border/50" />
              <div className="absolute left-0 top-[48%] h-px w-full bg-border/50" />
              <div className="absolute left-0 top-[68%] h-px w-full bg-border/50" />
              <div className="absolute left-[30%] top-0 h-full w-px bg-border/50" />
              <div className="absolute left-[60%] top-0 h-full w-px bg-border/50" />
              <div className="absolute left-4 top-4 rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-card">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium text-foreground">Barbearia</span>
                  <span className="text-muted-foreground">· Barra da Tijuca · 10 km</span>
                </div>
              </div>
              <div className="absolute left-[44%] top-[45%] h-[55%] w-[50%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary/15 bg-primary-subtle/20" />
              <div className="absolute left-[44%] top-[45%] z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-primary shadow-md ring-2 ring-primary/30" />
              {[
                { top: "26%", left: "50%", lead: DEMO_LEADS[0] },
                { top: "50%", left: "62%", lead: DEMO_LEADS[1] },
                { top: "36%", left: "34%", lead: DEMO_LEADS[2] },
                { top: "55%", left: "26%", lead: DEMO_LEADS[4] },
                { top: "44%", left: "72%", lead: DEMO_LEADS[4] },
              ].map((pin, i) => (
                <div
                  key={i}
                  className={cn(
                    "absolute z-10 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[10px] font-bold shadow-md ring-2 ring-white transition-transform hover:scale-110",
                    pin.lead.temperature === "hot" && "bg-hot text-hot-foreground",
                    pin.lead.temperature === "warm" && "bg-warm text-warm-foreground",
                    pin.lead.temperature === "cold" && "bg-cold text-cold-foreground",
                  )}
                  style={{ top: pin.top, left: pin.left }}
                >
                  {pin.lead.score}
                </div>
              ))}
              <div className="absolute bottom-4 left-4 right-4 rounded-lg border border-border bg-surface p-3 shadow-elevated">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">
                    {DEMO_LEADS[0].companyName}
                  </span>
                  <span className="rounded-md bg-hot-soft px-2 py-0.5 text-xs font-semibold text-hot">
                    Score {DEMO_LEADS[0].score}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {DEMO_LEADS[0].distanceKm} km
                  </span>
                  <span>⭐ {DEMO_LEADS[0].rating}</span>
                  <span className="text-primary font-medium">Alta oportunidade</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </MarketingContainer>
    </MarketingSection>
  );
}
