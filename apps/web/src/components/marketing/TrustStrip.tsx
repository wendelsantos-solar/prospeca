import { Search, Target, MessageCircle, CalendarDays, BadgeCheck, TrendingUp, Clock, Users, Database } from "lucide-react";
import { GoogleIcon, WhatsAppIcon } from "./brand-icons";
import { MarketingContainer } from "./MarketingLayout";

const STEPS = [
  { icon: Search, label: "Encontre", description: "Pesquise por nicho, cidade e raio de busca." },
  { icon: Target, label: "Priorize", description: "O score explica quem vale seu tempo primeiro — sem caixa-preta." },
  { icon: MessageCircle, label: "Aborde", description: "Mensagem pronta com os dados reais do lead." },
  { icon: CalendarDays, label: "Acompanhe", description: "Pipeline com próxima ação e lembrete, sem perder o fio." },
  { icon: BadgeCheck, label: "Converta", description: "Do primeiro contato ao fechamento, com contexto completo." },
];

const METRICS = [
  { value: "28M+", label: "CNPJs na base", description: "Cobertura nacional, dados públicos" },
  { value: "10h", label: "economizadas por semana", description: "Pesquisa e qualificação automatizadas" },
  { value: "6", label: "fatores de score", description: "Site, telefone, WhatsApp, avaliações, distância, Instagram" },
  { value: "+200", label: "profissionais", description: "Já estão prospectando com o Prospeca" },
];

export function TrustStrip() {
  return (
    <section className="bg-white py-16 md:py-24">
      <MarketingContainer width="default">
        {/* Section heading */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">Como funciona</p>
          <h2 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground md:text-[2.25rem]">
            Prospecção simples,
            <br />
            do início ao fechamento
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            Sem instalar nada. Configure uma vez e repita quantas vezes precisar.
          </p>
        </div>

        {/* Steps */}
        <div className="mt-14 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 md:grid-cols-5">
          {STEPS.map((step) => (
            <div key={step.label} className="group flex flex-col items-center text-center">
              <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl border border-border/70 bg-white text-primary shadow-sm transition-all group-hover:border-primary/20 group-hover:shadow-card">
                <step.icon className="h-5 w-5" />
              </div>
              <div className="text-[14px] font-semibold text-foreground">{step.label}</div>
              <div className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{step.description}</div>
            </div>
          ))}
        </div>

        {/* Metrics row */}
        <div className="mt-16 grid grid-cols-2 gap-8 border-t border-border/50 pt-14 sm:grid-cols-4">
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

        {/* Tech stack */}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-6 border-t border-border/50 pt-14">
          <p className="w-full text-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Tecnologia de ponta
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8">
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
      </MarketingContainer>
    </section>
  );
}
