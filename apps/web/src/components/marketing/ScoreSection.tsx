import { Globe, Phone, MessageCircle, Star, MapPin, Tag, Camera } from "lucide-react";
import { MarketingSection, MarketingContainer, SectionHeading } from "./MarketingLayout";
import { SCORE_CRITERIA, DEMO_LEADS } from "@/marketing/demo-data";
const ICON_MAP = { Globe, Phone, MessageCircle, Star, MapPin, Tag, Camera } as const;

export function ScoreSection() {
  const lead = DEMO_LEADS[0];
  return (
    <MarketingSection spacing="lg">
      <MarketingContainer width="default">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <SectionHeading
              eyebrow="Score"
              title="Saiba por que cada empresa foi priorizada."
              description="O score usa critérios comerciais fixos e documentados — não é uma caixa-preta. Cada ponto tem uma explicação clara."
            />
          </div>
          <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
            <div className="mb-5 flex items-baseline gap-2">
              <span className="text-4xl font-bold text-foreground">{lead.score}</span>
              <span className="text-sm text-muted-foreground">/100</span>
              <span className="ml-auto rounded-md bg-hot-soft px-2.5 py-1 text-xs font-semibold text-hot">
                Alta prioridade
              </span>
            </div>
            <ul className="space-y-2.5">
              {SCORE_CRITERIA.map((c) => {
                const Icon = ICON_MAP[c.icon];
                return (
                  <li
                    key={c.label}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-surface-2"
                  >
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                      {c.label}
                    </span>
                    <span className="font-mono text-sm font-semibold text-primary">
                      +{c.points}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </MarketingContainer>
    </MarketingSection>
  );
}
