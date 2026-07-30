import { Link } from "@tanstack/react-router";
import { Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section, SectionHeading } from "./Section";

const SIGNALS = [
  "não possui site",
  "avaliação 4,9",
  "telefone encontrado",
  "fica a 7,9 km",
  "ainda não foi contatada",
];

export function OpportunitySection() {
  return (
    <Section muted>
      <div className="grid items-center gap-10 md:grid-cols-2">
        <div>
          <SectionHeading
            eyebrow="Oportunidades"
            title="Uma lista de empresas não é suficiente."
            description="O Radar Local analisa os sinais disponíveis e ajuda você a identificar quais negócios merecem atenção primeiro."
          />
          <Button className="mt-6" asChild>
            <Link to="/cadastro">
              Descobrir oportunidades
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-base font-semibold text-foreground">Rústica Barbearia</span>
            <span className="rounded-md bg-hot-soft px-2.5 py-1 text-sm font-semibold text-hot">
              Score 89
            </span>
          </div>
          <p className="mb-3 text-xs font-medium text-muted-foreground">
            Alta oportunidade porque:
          </p>
          <ul className="space-y-2">
            {SIGNALS.map((signal) => (
              <li key={signal} className="flex items-center gap-2 text-sm text-foreground">
                <Check className="h-4 w-4 shrink-0 text-primary" />
                {signal}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
