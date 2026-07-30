import { Link } from "@tanstack/react-router";
import { Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section, SectionHeading } from "./Section";

const RESOURCES = [
  "Múltiplos usuários",
  "Responsáveis por lead",
  "Permissões por papel",
  "Múltiplos pipelines",
  "Relatórios por usuário",
  "Buscas salvas",
  "Monitoramento de buscas",
  "Automações leves",
];

export function AgencySection() {
  return (
    <Section id="agencias" muted>
      <SectionHeading
        eyebrow="Para agências"
        title="Feito para quem prospecta sozinho. Preparado para quem trabalha em equipe."
        center
      />
      <div className="mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        {RESOURCES.map((r) => (
          <div key={r} className="flex items-center gap-2 text-sm text-foreground">
            <Check className="h-4 w-4 shrink-0 text-primary" />
            {r}
          </div>
        ))}
      </div>
      <div className="mt-8 flex justify-center">
        <Button asChild>
          <Link to="/precos" hash="agencia">
            Conhecer o plano Agência
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </Section>
  );
}
