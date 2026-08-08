import { Link } from "@tanstack/react-router";
import { Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingSection, MarketingContainer, SectionHeading } from "./MarketingLayout";
import { BrowserFrame } from "./BrowserFrame";
import { DEMO_LEADS } from "@/marketing/demo-data";

export function OpportunitySection() {
  const lead = DEMO_LEADS[0];
  const signals = [
    { text: "Não possui site", present: !lead.hasWebsite },
    { text: "Telefone válido encontrado", present: lead.hasPhone },
    { text: "WhatsApp disponível", present: lead.hasWhatsapp },
    { text: `A ${lead.distanceKm} km de distância`, present: true },
    { text: "Boa avaliação (4.9 ★)", present: true },
  ];
  return (
    <MarketingSection muted spacing="lg">
      <MarketingContainer width="default">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <SectionHeading
              eyebrow="Encontre e priorize"
              title={
                <>
                  Uma lista não basta.
                  <br />
                  Você precisa de um score.
                </>
              }
              description="Cada empresa recebe uma nota de 0 a 100 baseada em site, telefone, WhatsApp, avaliações e distância. Você sabe exatamente por onde começar."
            />
            <Button className="mt-6" asChild>
              <Link to="/cadastro">
                Descobrir oportunidades
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <BrowserFrame>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">{lead.companyName}</span>
              <span className="rounded-md bg-hot-soft px-2 py-0.5 text-xs font-bold text-hot">
                Score {lead.score}
              </span>
            </div>
            <p className="mb-2 text-[11px] font-medium text-muted-foreground">
              Alta oportunidade porque:
            </p>
            <ul className="space-y-1.5">
              {signals.map((s) => (
                <li key={s.text} className="flex items-center gap-2 text-[12px] text-foreground">
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  {s.text}
                </li>
              ))}
            </ul>
          </BrowserFrame>
        </div>
      </MarketingContainer>
    </MarketingSection>
  );
}
