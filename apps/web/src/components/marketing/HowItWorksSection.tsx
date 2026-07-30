import { Section, SectionHeading } from "./Section";

const STEPS = [
  {
    n: "01",
    title: "Defina seu público",
    description: "Escolha o nicho, região, raio e presença digital que você quer encontrar.",
  },
  {
    n: "02",
    title: "Descubra oportunidades",
    description: "Visualize empresas no mapa e na lista, e entenda quais têm maior potencial.",
  },
  {
    n: "03",
    title: "Prepare sua abordagem",
    description: "Use os dados do lead e modelos de mensagem personalizados por variável.",
  },
  {
    n: "04",
    title: "Acompanhe até a conversão",
    description: "Organize Pipeline, tarefas, retornos e resultados num só lugar.",
  },
];

export function HowItWorksSection() {
  return (
    <Section id="como-funciona">
      <SectionHeading
        eyebrow="Como funciona"
        title="Da busca à venda, em quatro passos"
        description="Sem instalar nada. Configure uma vez e repita quantas vezes precisar."
      />
      <div className="mt-10 grid gap-6 md:grid-cols-4">
        {STEPS.map((step) => (
          <div key={step.n} className="rounded-xl border border-border bg-surface p-5">
            <div className="mb-3 text-2xl font-bold text-primary/30">{step.n}</div>
            <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
