import { Code2, Share2, Megaphone, Users, Cpu, Building2 } from "lucide-react";
import { Section, SectionHeading } from "./Section";

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
    description: "Distribua oportunidades, acompanhe a equipe e organize múltiplas campanhas.",
  },
];

export function UseCasesSection() {
  return (
    <Section id="para-quem">
      <SectionHeading
        eyebrow="Para quem é"
        title="Feito para quem vende serviço pra negócio local"
        description="Freelancers, agências pequenas e consultores que prospectam empresas locais."
        center
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {CASES.map((c) => (
          <div key={c.title} className="rounded-xl border border-border bg-surface p-5">
            <c.icon className="mb-3 h-5 w-5 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">{c.title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{c.description}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
