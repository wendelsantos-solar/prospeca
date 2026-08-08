import { Search, Target, MessageSquare, CalendarCheck, Layers, BarChart3 } from "lucide-react";
import { MarketingSection, MarketingContainer, SectionHeading } from "./MarketingLayout";

const BENEFITS = [
  {
    icon: Search,
    title: "Menos pesquisa manual",
    description: "Pare de copiar empresas uma por uma do mapa.",
  },
  {
    icon: Target,
    title: "Mais prioridade",
    description: "Comece pelos negócios com maior potencial comercial.",
  },
  {
    icon: MessageSquare,
    title: "Abordagem contextual",
    description: "Use informações reais para personalizar sua mensagem.",
  },
  {
    icon: CalendarCheck,
    title: "Follow-up organizado",
    description: "Não perca retornos e oportunidades por esquecimento.",
  },
  {
    icon: Layers,
    title: "Tudo em um lugar",
    description: "Busca, mapa, Pipeline e atividades conectados.",
  },
  {
    icon: BarChart3,
    title: "Resultado mensurável",
    description: "Acompanhe oportunidades, contatos e conversões.",
  },
];

export function BenefitsSection() {
  return (
    <MarketingSection spacing="lg">
      <MarketingContainer width="default">
        <SectionHeading
          center
          eyebrow="Por que o Prospeca"
          title={
            <>
              Tudo que você precisa<br />
              pra prospectar melhor
            </>
          }
          description="Da busca ao fechamento, cada funcionalidade foi pensada pra quem vende pra negócios locais."
        />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b) => (
            <div key={b.title} className="flex gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border bg-surface-2 text-primary">
                <b.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{b.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{b.description}</p>
              </div>
            </div>
          ))}
        </div>
      </MarketingContainer>
    </MarketingSection>
  );
}
