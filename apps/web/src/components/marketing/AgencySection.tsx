import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingSection, MarketingContainer, SectionHeading } from "./MarketingLayout";
import { SalesContactForm } from "./SalesContactForm";
import { track } from "@/lib/analytics";

export function AgencySection() {
  return (
    <MarketingSection id="agencias" muted spacing="lg">
      <MarketingContainer width="default">
        <SectionHeading
          eyebrow="Para equipes"
          title="Trabalha em equipe? O multiusuário está a caminho."
          description="Hoje o piloto é individual por organização. Múltiplos usuários, permissões por papel e relatórios por usuário estão no roadmap — entre na lista e avisamos assim que abrir."
          center
        />
        <div className="mt-8 flex justify-center">
          <SalesContactForm
            source="agency_waitlist"
            trigger={
              <Button
                onClick={() =>
                  track("agency_cta_clicked", { location: "agency_section", action: "waitlist" })
                }
              >
                <Users className="mr-1.5 h-4 w-4" />
                Entrar na lista de espera
              </Button>
            }
          />
        </div>
      </MarketingContainer>
    </MarketingSection>
  );
}
