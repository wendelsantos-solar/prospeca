import { Search, Target, MessageCircle, CalendarDays, BadgeCheck } from "lucide-react";

const STEPS = [
  { icon: Search, label: "Encontre", description: "Pesquise empresas por nicho, cidade e raio." },
  {
    icon: Target,
    label: "Priorize",
    description: "Veja quais negócios têm mais potencial e por quê.",
  },
  {
    icon: MessageCircle,
    label: "Aborde",
    description: "Prepare mensagens com dados reais do lead.",
  },
  {
    icon: CalendarDays,
    label: "Acompanhe",
    description: "Organize retornos e atividades sem perder o fio.",
  },
  {
    icon: BadgeCheck,
    label: "Converta",
    description: "Feche negócio com contexto do início ao fim.",
  },
];

export function TrustStrip() {
  return (
    <div className="border-y border-border bg-surface-2 py-10 md:py-12">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 sm:grid-cols-3 md:grid-cols-5 md:px-6 lg:px-8">
        {STEPS.map((step) => (
          <div key={step.label} className="group flex flex-col items-center text-center">
            <div className="mb-3 grid h-10 w-10 place-items-center rounded-lg border border-border bg-surface text-primary transition-colors group-hover:border-primary/30 group-hover:bg-primary-subtle">
              <step.icon className="h-5 w-5" />
            </div>
            <div className="text-sm font-semibold text-foreground">{step.label}</div>
            <div className="mt-1 text-xs text-muted-foreground">{step.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
