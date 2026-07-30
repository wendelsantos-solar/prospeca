import { Search, ListFilter, MessageCircle, CalendarCheck, Trophy } from "lucide-react";

const STEPS = [
  { icon: Search, label: "Encontre", description: "Pesquise empresas por nicho, cidade e raio." },
  {
    icon: ListFilter,
    label: "Priorize",
    description: "Veja quais negócios têm mais potencial e por quê.",
  },
  {
    icon: MessageCircle,
    label: "Aborde",
    description: "Prepare mensagens com dados reais do lead.",
  },
  {
    icon: CalendarCheck,
    label: "Acompanhe",
    description: "Organize retornos e atividades sem perder o fio.",
  },
  { icon: Trophy, label: "Converta", description: "Feche negócio com contexto do início ao fim." },
];

export function TrustStrip() {
  return (
    <div className="border-y border-border bg-surface-2 py-8">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 sm:grid-cols-3 md:grid-cols-5 md:px-6">
        {STEPS.map((step) => (
          <div
            key={step.label}
            className="flex flex-col items-center text-center md:items-start md:text-left"
          >
            <step.icon className="mb-2 h-4 w-4 text-primary" />
            <div className="text-sm font-semibold text-foreground">{step.label}</div>
            <div className="mt-1 text-xs text-muted-foreground">{step.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
