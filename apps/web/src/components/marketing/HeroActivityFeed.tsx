import { Check, Globe2, MapPin, Target } from "lucide-react";
import { DEMO_LEADS } from "@/marketing/demo-data";
import { WhatsAppIcon } from "./brand-icons";

const lead = DEMO_LEADS[0];

const SIGNALS = [
  { icon: Globe2, label: "Sem site" },
  { icon: WhatsAppIcon, label: "WhatsApp" },
  { icon: MapPin, label: `${lead.distanceKm.toLocaleString("pt-BR")} km` },
];

/**
 * Code-native product preview inspired by the social card. It remains readable,
 * responsive and accessible instead of embedding marketing copy in a bitmap.
 */
export function HeroActivityFeed() {
  return (
    <figure
      className="relative mx-auto w-full max-w-[540px] lg:mx-0"
      aria-label="Demonstração de uma oportunidade priorizada no Prospeca"
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2"
        aria-hidden="true"
      >
        <div className="absolute inset-0 rounded-full border border-primary/10" />
        <div className="absolute inset-[12%] rounded-full border border-primary/10" />
        <div className="absolute inset-[25%] rounded-full border border-primary/10" />
        <span className="absolute left-[8%] top-[30%] h-2.5 w-2.5 rounded-full bg-primary/20" />
        <span className="absolute bottom-[12%] right-[28%] h-2 w-2 rounded-full bg-primary/20" />
        <span className="absolute right-[7%] top-[44%] h-2.5 w-2.5 rounded-full bg-primary/20" />
      </div>

      <figcaption className="relative mb-3 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground lg:text-left">
        Demonstração do produto
      </figcaption>

      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-white p-5 shadow-elevated sm:p-7">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-primary-subtle blur-3xl"
          aria-hidden="true"
        />

        <div className="relative flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-primary/20 bg-primary-subtle text-primary sm:h-14 sm:w-14">
              <Target className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-foreground sm:text-lg">
                {lead.companyName}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {lead.category} · Barra da Tijuca
              </p>
            </div>
          </div>

          <div className="shrink-0 rounded-xl bg-warning-soft px-3 py-2 text-center">
            <span className="block text-[9px] font-semibold uppercase tracking-wider text-warning-foreground/70">
              Score
            </span>
            <span className="text-2xl font-bold leading-none text-warning sm:text-[1.75rem]">
              {lead.score}
            </span>
          </div>
        </div>

        <div className="relative mt-6 flex flex-wrap gap-2 border-y border-border/70 py-4">
          {SIGNALS.map((signal) => (
            <span
              key={signal.label}
              className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-2 text-xs font-medium text-foreground"
            >
              <signal.icon className="h-3.5 w-3.5 text-primary" />
              {signal.label}
            </span>
          ))}
        </div>

        <div className="relative mt-5 rounded-2xl bg-surface-2 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Por que priorizar
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              "Não possui site",
              "Telefone válido encontrado",
              "Boa avaliação no Google",
              "Está próxima da sua região",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-xs text-foreground">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                  <Check className="h-2.5 w-2.5" strokeWidth={2.5} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mt-5 flex items-center justify-between gap-3 rounded-xl border border-primary/15 bg-primary-subtle px-4 py-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Próxima ação sugerida
            </p>
            <p className="mt-0.5 text-xs font-semibold text-foreground">
              Abordar com contexto real
            </p>
          </div>
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-primary shadow-sm">
            <WhatsAppIcon className="h-4 w-4" />
          </div>
        </div>
      </div>
    </figure>
  );
}
