import { Code2, Share2, Megaphone, Users, Cpu, Building2 } from "lucide-react";
import { MarketingSection, MarketingContainer, SectionHeading } from "./MarketingLayout";

const CASES = [
  {
    icon: Code2,
    title: "Criação de sites",
    description: "Encontre empresas com boa reputação e sem site.",
  },
  {
    icon: Share2,
    title: "Social media",
    description: "Identifique negócios locais com presença social incompleta.",
  },
  {
    icon: Megaphone,
    title: "Tráfego pago",
    description: "Descubra empresas com potencial comercial em regiões específicas.",
  },
  {
    icon: Users,
    title: "Consultoria",
    description: "Monte listas qualificadas de negócios dentro do seu perfil ideal.",
  },
  {
    icon: Cpu,
    title: "Software e automação",
    description: "Encontre empresas que podem se beneficiar da sua solução.",
  },
  {
    icon: Building2,
    title: "Agências",
    description:
      "Centralize a prospecção da agência em um pipeline único, do contato ao fechamento.",
  },
];

export function UseCasesSection() {
  return (
    <MarketingSection id="para-quem" spacing="lg">
      <MarketingContainer width="default">
        <SectionHeading
          eyebrow="Para quem é"
          title="Feito para quem vende serviço pra negócio local"
          description="Freelancers, agências pequenas e consultores que prospectam empresas locais."
          center
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CASES.map((c) => (
            <div
              key={c.title}
              className="group rounded-xl border border-border bg-surface p-5 transition-colors hover:border-primary/20 hover:bg-surface-hover"
            >
              <div className="mb-3 grid h-10 w-10 place-items-center rounded-lg border border-border bg-surface-2 text-primary transition-colors group-hover:border-primary/30 group-hover:bg-primary-subtle">
                <c.icon className="h-5 w-5" />
              </div>
              <h3 className="text-body font-semibold text-foreground">{c.title}</h3>
              <p className="mt-1.5 text-body text-muted-foreground">{c.description}</p>
            </div>
          ))}
        </div>
      </MarketingContainer>
    </MarketingSection>
  );
}
