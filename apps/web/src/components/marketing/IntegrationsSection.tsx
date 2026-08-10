import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  ExternalLink,
  ShieldCheck,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingContainer, MarketingSection, SectionHeading } from "./MarketingLayout";
import { GoogleIcon } from "./brand-icons";

const BENEFITS = [
  {
    icon: CalendarDays,
    title: "Evento no Google Calendar",
    description:
      "Data, horário, duração e contato organizados sem precisar cadastrar tudo de novo.",
  },
  {
    icon: Video,
    title: "Link exclusivo do Google Meet",
    description: "Gere a sala da reunião junto com o evento e acesse pelo Prospeca.",
  },
  {
    icon: Clock3,
    title: "Agenda comercial conectada",
    description: "Reuniões e próximos contatos continuam visíveis no fluxo das oportunidades.",
  },
];

function CalendarPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[560px]">
      <div className="absolute -inset-10 -z-10 rounded-full bg-primary/10 blur-3xl" />

      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-elevated">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-white">
              <GoogleIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-foreground">
                Google Calendar + Meet
              </p>
              <p className="text-[11px] text-muted-foreground">Conta conectada</p>
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary-soft px-2 py-1 text-[10px] font-semibold text-primary">
            <Check className="h-3 w-3" /> Ativo
          </span>
        </div>

        <div className="bg-surface-2/60 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Agenda comercial
              </p>
              <p className="mt-0.5 text-sm font-semibold text-foreground">Sexta, 8 de agosto</p>
            </div>
            <span className="rounded-lg border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-foreground">
              Semana
            </span>
          </div>

          <div className="grid grid-cols-[46px_1fr] gap-3">
            <div className="pt-3 text-right text-[10px] text-muted-foreground">14:30</div>
            <div className="rounded-xl border-l-4 border-l-primary border-y border-r border-border bg-surface p-3.5 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    <Video className="h-3 w-3" /> Reunião
                  </div>
                  <p className="truncate text-[13px] font-semibold text-foreground">
                    Reunião de diagnóstico
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    Rústica Barbearia · 14:30–15:00
                  </p>
                </div>
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                  <CalendarDays className="h-4 w-4" />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-[10px] font-semibold text-primary-foreground">
                  <Video className="h-3 w-3" /> Entrar no Meet
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[10px] font-medium text-foreground">
                  <ExternalLink className="h-3 w-3" /> Ver no Calendar
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 text-[10px] font-medium text-muted-foreground">
            <span className="rounded-md border border-border bg-surface px-2 py-1">
              Oportunidade
            </span>
            <ArrowRight className="h-3 w-3 text-primary" />
            <span className="rounded-md border border-border bg-surface px-2 py-1">Agenda</span>
            <ArrowRight className="h-3 w-3 text-primary" />
            <span className="rounded-md border border-primary/20 bg-primary-soft px-2 py-1 text-primary">
              Reunião
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function IntegrationsSection() {
  return (
    <MarketingSection id="integracoes" spacing="lg" className="overflow-hidden">
      <MarketingContainer width="default">
        <div className="grid items-center gap-12 md:grid-cols-[0.9fr_1.1fr] md:gap-16">
          <div>
            <SectionHeading
              eyebrow="Google Calendar + Meet"
              title={
                <>
                  Da oportunidade à reunião,
                  <br />
                  sem perder o próximo passo.
                </>
              }
              description="Conecte sua conta Google uma vez. Ao marcar uma reunião no Prospeca, você pode criar o evento no Calendar, gerar um link exclusivo do Meet e acompanhar tudo na sua Agenda comercial."
            />

            <div className="mt-7 space-y-4">
              {BENEFITS.map((benefit) => (
                <div key={benefit.title} className="flex gap-3">
                  <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-primary/15 bg-primary-soft text-primary">
                    <benefit.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{benefit.title}</h3>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
                      {benefit.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-7 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <Button asChild>
                <Link to="/cadastro">
                  Organizar minha prospecção
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <p className="flex max-w-xs items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                Sua agenda pessoal não é importada. O Prospeca trabalha somente com as atividades
                comerciais que você escolher adicionar.
              </p>
            </div>
          </div>

          <CalendarPreview />
        </div>
      </MarketingContainer>
    </MarketingSection>
  );
}
