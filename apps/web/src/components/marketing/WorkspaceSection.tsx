import {
  Search,
  MapPin,
  Star,
  TrendingUp,
  MessageCircle,
  GitBranch,
  CalendarCheck,
  FileSpreadsheet,
} from "lucide-react";
import { MarketingSection, MarketingContainer, SectionHeading } from "./MarketingLayout";
import { DEMO_LEADS, PIPELINE_STAGES } from "@/marketing/demo-data";
import { cn } from "@/lib/utils";
import { WhatsAppIcon } from "./brand-icons";

/**
 * WorkspaceSection — consolidated product showcase.
 * Merges what was previously 5 separate sections (Opportunity, Score,
 * Map, Pipeline, Messaging) into 2 side-by-side panels — exactly
 * like Kaptto's "Workspace" section.
 *
 * Panel 1 (left): Search + Map + Lead Discovery
 * Panel 2 (right): Pipeline + Messaging + Activity
 */

const hotLead = DEMO_LEADS[0];
const contactedLead = DEMO_LEADS[2];

/* ── Panel 1: Search → Discovery ── */
function DiscoveryPanel() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
      {/* Browser chrome */}
      <div className="mb-4 flex items-center gap-1.5">
        <div className="h-2.5 w-2.5 rounded-full bg-stage-discarded/40" />
        <div className="h-2.5 w-2.5 rounded-full bg-stage-qualified/40" />
        <div className="h-2.5 w-2.5 rounded-full bg-stage-new/40" />
        <div className="ml-2 flex-1 rounded-md bg-surface-2 px-3 py-1 text-[11px] text-muted-foreground">
          app.prospeca.com.br
        </div>
      </div>

      {/* Search bar */}
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="text-muted-foreground">
          <span className="font-medium text-foreground">Barbearia</span>
          {" · "}Barra da Tijuca · 10 km
        </span>
        <span className="ml-auto shrink-0 rounded bg-primary-soft px-1.5 py-0.5 text-[10px] font-semibold text-primary">
          34
        </span>
      </div>

      {/* Mini map */}
      <div className="relative mb-3 h-44 overflow-hidden rounded-lg bg-[oklch(0.965_0.01_140)]">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle,_var(--border)_1px,_transparent_1px)] [background-size:18px_18px]" />
        <div className="absolute left-0 top-[30%] h-px w-full bg-border/40" />
        <div className="absolute left-0 top-[55%] h-px w-full bg-border/40" />
        <div className="absolute left-[35%] top-0 h-full w-px bg-border/40" />
        <div className="absolute left-[62%] top-0 h-full w-px bg-border/40" />

        {/* Radius circle */}
        <div className="absolute left-[44%] top-[48%] h-[60%] w-[55%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary/15 bg-primary-subtle/15" />

        {/* Lead pins */}
        <div
          className="absolute z-10 grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[10px] font-bold text-white shadow-md ring-2 ring-white"
          style={{ top: "28%", left: "50%", background: "#f97316" }}
        >
          89
        </div>
        <div
          className="absolute z-10 grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[10px] font-bold text-white shadow-md ring-2 ring-white"
          style={{ top: "52%", left: "62%", background: "#eab308" }}
        >
          76
        </div>
        <div
          className="absolute z-10 grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[10px] font-bold text-white shadow-md ring-2 ring-white"
          style={{ top: "42%", left: "28%", background: "#f97316" }}
        >
          81
        </div>

        {/* Results count pill */}
        <div className="absolute left-1/2 top-2 -translate-x-1/2 rounded-lg border border-border bg-surface/95 px-2.5 py-1 text-[10px] font-medium shadow-card backdrop-blur">
          4 <span className="text-muted-foreground">de 34 no raio</span>
        </div>
      </div>

      {/* Opportunity card */}
      <div className="rounded-lg border border-primary/20 bg-surface-2 p-4">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-foreground">{hotLead.companyName}</span>
          <span className="rounded-md bg-hot-soft px-2 py-0.5 text-[11px] font-bold text-hot">
            Score {hotLead.score}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {hotLead.distanceKm} km
          </span>
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3" /> {hotLead.rating} · {hotLead.reviewCount}
          </span>
          <span className="flex items-center gap-1 font-medium text-primary">
            <TrendingUp className="h-3 w-3" /> Não possui site
          </span>
        </div>
      </div>

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        Encontre → Qualifique → Priorize. Tudo numa busca.
      </p>
    </div>
  );
}

/* ── Panel 2: Pipeline → Messaging → Close ── */
function PipelinePanel() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
      {/* Browser chrome */}
      <div className="mb-4 flex items-center gap-1.5">
        <div className="h-2.5 w-2.5 rounded-full bg-stage-discarded/40" />
        <div className="h-2.5 w-2.5 rounded-full bg-stage-qualified/40" />
        <div className="h-2.5 w-2.5 rounded-full bg-stage-new/40" />
        <div className="ml-2 flex-1 rounded-md bg-surface-2 px-3 py-1 text-[11px] text-muted-foreground">
          Pipeline · Meu funil
        </div>
      </div>

      {/* Pipeline stages */}
      <div className="mb-4 flex gap-2 text-center text-[10px]">
        {PIPELINE_STAGES.slice(0, 5).map((stage, i) => (
          <div
            key={stage.key}
            className={cn(
              "flex-1 rounded-lg p-2.5",
              stage.key === "won"
                ? "bg-stage-won-soft"
                : stage.key === "contacted"
                  ? "bg-stage-contacted-soft"
                  : "bg-surface-2",
            )}
          >
            <div className="font-bold text-foreground">{stage.count}</div>
            <div className="text-muted-foreground">{stage.label}</div>
          </div>
        ))}
      </div>

      {/* Active lead detail */}
      <div className="rounded-lg border border-border bg-surface-2 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-foreground">
            {contactedLead.companyName}
          </span>
          <span className="rounded bg-stage-contacted-soft px-1.5 py-0.5 text-[10px] font-semibold text-stage-contacted">
            Em conversa
          </span>
        </div>
        <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>
            Contato: <strong className="text-foreground">{contactedLead.contactName}</strong>
          </span>
          <span className="flex items-center gap-1">
            <CalendarCheck className="h-3 w-3 text-primary" /> Retornar quinta
          </span>
        </div>
      </div>

      {/* WhatsApp message preview */}
      <div className="mt-3 rounded-lg bg-[oklch(0.86_0.13_140)] p-3">
        <div className="mb-1.5 flex items-center gap-1.5">
          <WhatsAppIcon className="h-3.5 w-3.5" />
          <span className="text-[10px] font-medium text-[#075e54]">WhatsApp</span>
        </div>
        <p className="text-[11px] leading-relaxed text-[#075e54]">
          Oi {hotLead.contactName}! Vi que a <strong>{hotLead.companyName}</strong> ainda não tem
          site — com {hotLead.rating}★ e {hotLead.reviewCount} avaliações no Google, um site
          profissional pode transformar esse reconhecimento em clientes. Posso te mandar uns
          exemplos?
        </p>
        <div className="mt-2 flex items-center justify-between text-[9px] text-[#667781]">
          <span>12:34</span>
          <span className="flex items-center gap-1">
            <Checkmark />
            Enviada
          </span>
        </div>
      </div>

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        Pipeline → Mensagem → Follow-up → Fechamento.
      </p>
    </div>
  );
}

function Checkmark() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path
        d="M2 6L5 9L10 3"
        stroke="#667781"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function WorkspaceSection() {
  return (
    <MarketingSection id="recursos" spacing="lg">
      <MarketingContainer width="wide">
        <SectionHeading
          center
          eyebrow="Workspace"
          title={
            <>
              Seu workspace completo,
              <br />
              da busca à reunião
            </>
          }
          description="Busque, qualifique e acompanhe cada conversa numa plataforma só. Mantenha o funil alinhado sem esforço."
        />

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <div>
            <DiscoveryPanel />
            <div className="mt-4 flex items-start gap-3 px-2">
              <Search className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <h3 className="text-[13px] font-semibold text-foreground">
                  Encontre oportunidades reais
                </h3>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Defina o perfil uma vez; a plataforma mantém o funil cheio com empresas pontuadas
                  e prontas pra abordagem.
                </p>
              </div>
            </div>
          </div>
          <div>
            <PipelinePanel />
            <div className="mt-4 flex items-start gap-3 px-2">
              <GitBranch className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <h3 className="text-[13px] font-semibold text-foreground">
                  Feche melhor cada negócio
                </h3>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Você aborda com contexto real: sabe quem é a empresa, o que dói e o que já foi
                  conversado.
                </p>
              </div>
            </div>
          </div>
        </div>
      </MarketingContainer>
    </MarketingSection>
  );
}
