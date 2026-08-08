import { Search, Target, MessageCircle, CalendarDays, BadgeCheck, TrendingUp, Clock, Users, Database } from "lucide-react";
import { GoogleIcon, WhatsAppIcon } from "./brand-icons";

const STEPS = [
  { icon: Search, label: "Encontre", description: "Pesquise por nicho, cidade e raio de busca." },
  {
    icon: Target,
    label: "Priorize",
    description: "O score explica quem vale seu tempo primeiro — sem caixa-preta.",
  },
  {
    icon: MessageCircle,
    label: "Aborde",
    description: "Mensagem pronta com os dados reais do lead.",
  },
  {
    icon: CalendarDays,
    label: "Acompanhe",
    description: "Pipeline com próxima ação e lembrete, sem perder o fio.",
  },
  {
    icon: BadgeCheck,
    label: "Converta",
    description: "Do primeiro contato ao fechamento, com contexto completo.",
  },
];

const METRICS = [
  {
    icon: TrendingUp,
    value: "28M+",
    label: "CNPJs na base",
    description: "Cobertura nacional, dados públicos",
  },
  {
    icon: Clock,
    value: "10h",
    label: "economizadas por semana",
    description: "Pesquisa e qualificação automatizadas",
  },
  {
    icon: Target,
    value: "6",
    label: "fatores de score",
    description: "Site, telefone, WhatsApp, avaliações, distância, Instagram",
  },
  {
    icon: Users,
    value: "+200",
    label: "profissionais",
    description: "Já estão prospectando com o Prospeca",
  },
];

export function TrustStrip() {
  return (
    <div className="border-y border-border bg-surface-2 py-10 md:py-14">
      <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8">
        {/* Steps */}
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-5">
          {STEPS.map((step) => (
            <div key={step.label} className="group flex flex-col items-center text-center">
              <div className="mb-3 grid h-10 w-10 place-items-center rounded-lg border border-border bg-surface text-primary transition-colors group-hover:border-primary/30 group-hover:bg-primary-subtle">
                <step.icon className="h-5 w-5" />
              </div>
              <div className="text-body font-semibold text-foreground">{step.label}</div>
              <div className="mt-1 text-caption text-muted-foreground">{step.description}</div>
            </div>
          ))}
        </div>

        {/* Metrics row */}
        <div className="mt-10 grid grid-cols-2 gap-6 border-t border-border pt-10 sm:grid-cols-4">
          {METRICS.map((m) => (
            <div key={m.label} className="text-center">
              <div className="text-[2rem] font-bold tracking-tight text-foreground md:text-[2.5rem]">
                {m.value}
              </div>
              <div className="mt-1 text-[13px] font-medium text-foreground">{m.label}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{m.description}</div>
            </div>
          ))}
        </div>

        {/* Tech stack logos — like Kaptto's customer logos, but for the technology Prospeca runs on */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-8 border-t border-border pt-10">
          <p className="w-full text-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Tecnologia de ponta
          </p>
          <div className="flex items-center gap-8">
            <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
              <GoogleIcon className="h-4 w-4" />
              Google Maps + OAuth
            </span>
            <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
              <WhatsAppIcon className="h-4 w-4" />
              WhatsApp Business
            </span>
            <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
              <Database className="h-4 w-4" />
              CNPJ + Supabase
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
