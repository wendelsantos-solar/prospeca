import { Section, SectionHeading } from "./Section";

const FACTORS = [
  { label: "Não possui site", points: "+25" },
  { label: "Telefone encontrado", points: "+15" },
  { label: "Boa avaliação", points: "+10" },
  { label: "Mais de 50 avaliações", points: "+10" },
  { label: "Está próxima", points: "+10" },
  { label: "WhatsApp provável", points: "+7" },
  { label: "Perfil atualizado", points: "+5" },
];

export function ScoreSection() {
  return (
    <Section>
      <div className="grid items-center gap-10 md:grid-cols-2">
        <div>
          <SectionHeading
            eyebrow="Score"
            title="Saiba por que cada empresa foi priorizada."
            description="O score usa critérios comerciais configuráveis — não é uma caixa-preta. Cada ponto tem uma explicação."
          />
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">82</span>
            <span className="text-sm text-muted-foreground">/100</span>
          </div>
          <ul className="space-y-2.5">
            {FACTORS.map((f) => (
              <li key={f.label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{f.label}</span>
                <span className="font-mono font-semibold text-primary">{f.points}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
