import { Link } from "@tanstack/react-router";
import { Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingSection, MarketingContainer, SectionHeading } from "./MarketingLayout";
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
          <div className="rounded-xl border border-primary/20 bg-surface p-5 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-base font-semibold text-foreground">{lead.companyName}</span>
              <span className="rounded-md bg-hot-soft px-2.5 py-1 text-sm font-semibold text-hot">
                Score {lead.score}
              </span>
            </div>
            <p className="mb-3 text-xs font-medium text-muted-foreground">
              Alta oportunidade porque:
            </p>
            <ul className="space-y-2">
              {signals.map((s) => (
                <li key={s.text} className="flex items-center gap-2 text-sm text-foreground">
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                  {s.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </MarketingContainer>
    </MarketingSection>
  );
}
