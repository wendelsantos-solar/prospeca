import { Section, SectionHeading } from "./Section";

const BENEFITS = [
  { title: "Menos pesquisa manual", description: "Pare de copiar empresas uma por uma." },
  { title: "Mais prioridade", description: "Comece pelos negócios com maior potencial." },
  {
    title: "Abordagem contextual",
    description: "Use informações reais para personalizar sua mensagem.",
  },
  { title: "Follow-up organizado", description: "Não perca retornos e oportunidades." },
  { title: "Tudo em um lugar", description: "Busca, mapa, Pipeline e atividades conectados." },
  {
    title: "Resultado mensurável",
    description: "Acompanhe oportunidades, contatos e conversões.",
  },
];

export function BenefitsSection() {
  return (
    <Section>
      <SectionHeading title="Por que usar o Radar Local" center />
      <div className="mt-10 grid gap-6 sm:grid-cols-2 md:grid-cols-3">
        {BENEFITS.map((b) => (
          <div key={b.title}>
            <h3 className="text-sm font-semibold text-foreground">{b.title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{b.description}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
