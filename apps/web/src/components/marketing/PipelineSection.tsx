import { Section, SectionHeading } from "./Section";

const STAGES = ["Novo", "Qualificado", "Contatado", "Ganho", "Descartado"];

const BENEFITS = [
  "Arrastar e soltar entre estágios",
  "Próxima ação sugerida",
  "Responsável e histórico",
  "Valor estimado",
  "Motivo de perda registrado",
];

export function PipelineSection() {
  return (
    <Section>
      <SectionHeading
        eyebrow="Pipeline"
        title="Da descoberta ao fechamento, sem perder o contexto."
        center
      />
      <div className="mt-10 grid gap-2 md:grid-cols-5">
        {STAGES.map((stage) => (
          <div key={stage} className="rounded-lg border border-border bg-surface p-3 text-center">
            <span className="text-sm font-medium text-foreground">{stage}</span>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-x-6 gap-y-2">
        {BENEFITS.map((b) => (
          <span key={b} className="text-sm text-muted-foreground">
            · {b}
          </span>
        ))}
      </div>
    </Section>
  );
}
