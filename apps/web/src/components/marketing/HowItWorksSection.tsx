import { useState, type ReactNode } from "react";
import {
  Search,
  MapPin,
  MessageCircle,
  GitBranch,
  TrendingUp,
  Target,
  Star,
  Phone,
  CalendarCheck,
} from "lucide-react";
import { MarketingSection, MarketingContainer, SectionHeading } from "./MarketingLayout";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { DEMO_LEADS, SCORE_CRITERIA } from "@/marketing/demo-data";
import { cn } from "@/lib/utils";

/**
 * HowItWorksSection — interactive tabs that switch between four product moments.
 * Each tab shows a matching visual demo on the right panel.
 */

type Tab = "search" | "score" | "message" | "pipeline";

interface TabDef {
  key: Tab;
  icon: React.ReactNode;
  label: string;
  title: string;
  description: string;
}

const TABS: TabDef[] = [
  {
    key: "search",
    icon: <Search className="h-4 w-4" />,
    label: "Busca",
    title: "Encontre seu ICP em segundos",
    description:
      "Defina nicho, região e raio. A plataforma varre CNPJs e Google Maps e devolve uma lista ranqueada com dados reais de cada empresa.",
  },
  {
    key: "score",
    icon: <Target className="h-4 w-4" />,
    label: "Score",
    title: "Entenda por que cada lead merece seu tempo",
    description:
      "O score de 0 a 100 mostra, com transparência, quais fatores tornam cada empresa uma oportunidade — ou não.",
  },
  {
    key: "message",
    icon: <MessageCircle className="h-4 w-4" />,
    label: "Mensagem",
    title: "Abra conversa com contexto real",
    description:
      "Mensagens prontas com nome do dono e a oportunidade detectada. Você revisa e envia pelo seu WhatsApp — nada sai sem você.",
  },
  {
    key: "pipeline",
    icon: <GitBranch className="h-4 w-4" />,
    label: "Pipeline",
    title: "Acompanhe cada lead até fechar",
    description:
      "Mova leads entre estágios, registre follow-ups e veja seu funil crescer. Tudo organizado num pipeline visual.",
  },
];

/* ── Mini visual demos for each tab ── */

function SearchDemo() {
  const hot = DEMO_LEADS[0];
  const warm = DEMO_LEADS[1];
  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="text-muted-foreground">
          <span className="font-medium text-foreground">Barbearia</span>
          {" · "}Barra da Tijuca · 10 km
        </span>
        <span className="ml-auto shrink-0 rounded bg-primary-soft px-1.5 py-0.5 text-[10px] font-semibold text-primary">
          34
        </span>
      </div>
      {/* Results */}
      <div className="rounded-lg border border-border bg-surface p-3">
        {[hot, warm].map((lead) => (
          <div
            key={lead.id}
            className="flex items-center gap-3 border-b border-border py-2.5 last:border-0 first:pt-0 last:pb-0"
          >
            <span
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white",
                lead.temperature === "hot" ? "bg-hot" : "bg-warm",
              )}
            >
              {lead.score}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-foreground">{lead.companyName}</div>
              <div className="text-[11px] text-muted-foreground">
                {lead.category} · {lead.distanceKm} km
              </div>
            </div>
            <span className="shrink-0 text-[11px] text-muted-foreground">{lead.rating} ★</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreDemo() {
  const lead = DEMO_LEADS[0];
  return (
    <div className="space-y-3">
      {/* Score card */}
      <div className="rounded-lg border border-primary/20 bg-surface p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">{lead.companyName}</span>
          <span className="rounded-md bg-hot-soft px-2.5 py-0.5 text-xs font-bold text-hot">
            Score {lead.score}
          </span>
        </div>
        <p className="mt-2 text-[11px] font-medium text-muted-foreground">
          Alta oportunidade — a empresa não tem site mas tem telefone e WhatsApp.
        </p>
        <div className="mt-3 space-y-1.5">
          {SCORE_CRITERIA.slice(0, 5).map((c) => (
            <div key={c.label} className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">{c.label}</span>
              <span className="font-semibold text-foreground">+{c.points}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageDemo() {
  const lead = DEMO_LEADS[0];
  return (
    <div className="space-y-3">
      {/* Message preview */}
      <div className="rounded-lg border border-border bg-[#d9fdd3] p-3">
        <p className="text-[12px] leading-relaxed text-[#075e54]">
          Oi {lead.contactName}! Vi que a <strong>{lead.companyName}</strong> ainda não tem site.
          Com {lead.rating}★ e {lead.reviewCount} avaliações no Google, um site profissional pode
          transformar esse reconhecimento em clientes.
        </p>
        <span className="mt-1.5 block text-[10px] text-[#667781]">12:34</span>
      </div>
      <p className="text-center text-[10px] text-muted-foreground">
        Você confirma e envia pelo seu WhatsApp — nada sai sem sua revisão.
      </p>
    </div>
  );
}

function PipelineDemo() {
  const stages = [
    { label: "Novo", count: 12, color: "bg-stage-new" },
    { label: "Qualif.", count: 5, color: "bg-stage-qualified" },
    { label: "Contact.", count: 3, color: "bg-stage-contacted" },
    { label: "Ganho", count: 1, color: "bg-stage-won" },
  ];
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-surface p-3">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <GitBranch className="h-3 w-3" /> Pipeline ativo
        </div>
        <div className="flex gap-2 text-[11px]">
          {stages.map((s) => (
            <div key={s.label} className="flex-1 rounded-md bg-surface-2 p-2 text-center">
              <div className="font-semibold text-foreground">{s.count}</div>
              <div className="text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Upcoming follow-up */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 text-[11px]">
        <CalendarCheck className="h-3.5 w-3.5 text-primary" />
        <span className="text-muted-foreground">
          Próximo follow-up:{" "}
          <strong className="text-foreground">{DEMO_LEADS[2].companyName}</strong> · amanhã
        </span>
      </div>
    </div>
  );
}

const DEMO_MAP: Record<Tab, () => ReactNode> = {
  search: () => <SearchDemo />,
  score: () => <ScoreDemo />,
  message: () => <MessageDemo />,
  pipeline: () => <PipelineDemo />,
};

export function HowItWorksSection() {
  const [tab, setTab] = useState<Tab>("search");
  const current = TABS.find((t) => t.key === tab)!;
  const Demo = DEMO_MAP[tab];

  return (
    <MarketingSection id="como-funciona" spacing="lg">
      <MarketingContainer width="default">
        <SectionHeading
          center
          eyebrow="Como funciona"
          title={
            <>
              Da busca ao próximo contato
              <br />
              em um fluxo que você controla
            </>
          }
          description="Encontre, priorize, aborde e acompanhe. A plataforma organiza o trabalho; você conduz a conversa."
        />

        <div className="mt-12 grid items-start gap-10 md:grid-cols-[0.95fr_1.05fr] md:gap-16">
          {/* Left: toggles + text */}
          <div>
            {/* Pill toggles */}
            <div
              className="grid w-full grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1 sm:inline-flex sm:w-auto sm:rounded-full"
              role="tablist"
              aria-label="Etapas da prospecção"
            >
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  role="tab"
                  aria-selected={tab === t.key}
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-all sm:rounded-full sm:px-4",
                    tab === t.key
                      ? "bg-surface text-foreground shadow-card"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {/* Title + desc for current tab */}
            <h3 className="mt-7 text-[20px] font-semibold tracking-tight text-foreground">
              {current.title}
            </h3>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {current.description}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="sm" asChild>
                <Link to="/cadastro">Criar conta grátis</Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href="#precos">Ver planos</a>
              </Button>
            </div>
          </div>

          {/* Right: visual demo panel */}
          <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-2 p-5 md:p-6">
            {/* Subtle glow behind content */}
            <div
              className="pointer-events-none absolute -right-20 -top-20 h-[60%] w-[60%] rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 70% 30%, rgba(22,163,74,0.08) 0%, rgba(22,163,74,0.03) 50%, transparent 70%)",
                filter: "blur(20px)",
              }}
            />
            <div className="relative z-10" key={tab}>
              <div className="animate-fade-in">
                <Demo />
              </div>
            </div>
          </div>
        </div>
      </MarketingContainer>
    </MarketingSection>
  );
}
