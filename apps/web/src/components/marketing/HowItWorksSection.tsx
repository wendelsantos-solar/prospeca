import { Search, MapPin, MessageCircle, GitBranch } from "lucide-react";
import { MarketingSection, MarketingContainer, SectionHeading } from "./MarketingLayout";

const STEPS = [
  {
    n: "01",
    icon: Search,
    title: "Defina seu público",
    description:
      "Escolha o nicho, região, raio e critérios de presença digital que você quer encontrar.",
  },
  {
    n: "02",
    icon: MapPin,
    title: "Descubra oportunidades",
    description:
      "Visualize empresas no mapa e na lista, entenda quais têm maior potencial com o score.",
  },
  {
    n: "03",
    icon: MessageCircle,
    title: "Prepare sua abordagem",
    description: "Use dados reais do lead e modelos de mensagem personalizados por variável.",
  },
  {
    n: "04",
    icon: GitBranch,
    title: "Acompanhe até a conversão",
    description: "Organize Pipeline, tarefas, retornos e resultados num só lugar.",
  },
];

export function HowItWorksSection() {
  return (
    <MarketingSection id="como-funciona" spacing="lg">
      <MarketingContainer width="default">
        <SectionHeading
          eyebrow="Como funciona"
          title="Da busca à venda, em quatro passos"
          description="Sem instalar nada. Configure uma vez e repita quantas vezes precisar."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-4">
          {STEPS.map((step) => (
            <div
              key={step.n}
              className="group rounded-xl border border-border bg-surface p-5 transition-colors hover:border-primary/20 hover:bg-surface-hover"
            >
              <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg border border-border bg-surface-2 text-primary transition-colors group-hover:border-primary/30 group-hover:bg-primary-subtle">
                <step.icon className="h-5 w-5" />
              </div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Passo {step.n}
              </div>
              <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </MarketingContainer>
    </MarketingSection>
  );
}
