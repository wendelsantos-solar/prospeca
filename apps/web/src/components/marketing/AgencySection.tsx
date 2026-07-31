import { Link } from "@tanstack/react-router";
import { Check, ArrowRight, Users, Shield, BarChart3, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingSection, MarketingContainer, SectionHeading } from "./MarketingLayout";

const RESOURCES = [
  { icon: Users, label: "Múltiplos usuários" },
  { icon: Shield, label: "Permissões por papel" },
  { icon: Save, label: "Buscas salvas compartilhadas" },
  { icon: BarChart3, label: "Relatórios por usuário" },
];
const FEATURES = [
  "Responsáveis por lead",
  "Múltiplos pipelines",
  "Monitoramento de buscas",
  "Automações leves",
];

export function AgencySection() {
  return (
    <MarketingSection id="agencias" muted spacing="lg">
      <MarketingContainer width="default">
        <SectionHeading
          eyebrow="Para agências"
          title="Feito para quem prospecta sozinho. Preparado para quem trabalha em equipe."
          center
        />
        <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
          {RESOURCES.map((r) => (
            <div
              key={r.label}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4"
            >
              <r.icon className="h-5 w-5 shrink-0 text-primary" />
              <span className="text-sm font-medium text-foreground">{r.label}</span>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-4 grid max-w-3xl grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4 shrink-0 text-primary" />
              {f}
            </div>
          ))}
        </div>
        <div className="mt-10 flex justify-center">
          <Button asChild>
            <Link to="/precos" hash="agencia">
              Conhecer o plano Agência
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </MarketingContainer>
    </MarketingSection>
  );
}
