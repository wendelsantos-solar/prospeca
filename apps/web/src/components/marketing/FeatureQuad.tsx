import type { LucideIcon } from "lucide-react";
import { Search, Target, MessageSquareText, GitBranch } from "lucide-react";
import { MarketingContainer, SectionHeading } from "./MarketingLayout";
import { AnimatedSection } from "./AnimatedSection";

/**
 * FeatureQuad — 2×2 benefit grid with a crosshair center.
 * Condenses the four core value props into a single scannable block.
 *
 * Inspired by Kaptto's quad grid, using Prospeca's design tokens.
 */

interface QuadCell {
  icon: LucideIcon;
  title: string;
  description: string;
}

const CELLS: QuadCell[] = [
  {
    icon: Search,
    title: "Encontre seu ICP em segundos",
    description:
      "Filtre por nicho e região, e receba uma lista ranqueada de oportunidades — sem garimpar mapa ou planilha.",
  },
  {
    icon: Target,
    title: "Priorize com Score de 0 a 100",
    description:
      "Cada empresa ganha uma nota baseada em site, avaliações, WhatsApp e distância. Você sabe exatamente por onde começar.",
  },
  {
    icon: MessageSquareText,
    title: "Aborde com contexto real",
    description:
      "Mensagens prontas com nome do dono, dor do negócio e oportunidade detectada. Nada de template genérico.",
  },
  {
    icon: GitBranch,
    title: "Acompanhe no Pipeline",
    description:
      "Do primeiro contato ao fechamento: mova leads entre estágios, registre follow-ups e veja seu funil crescer.",
  },
];

export function FeatureQuad() {
  return (
    <section className="py-20 md:py-24">
      <MarketingContainer width="default">
        <AnimatedSection>
          <SectionHeading
            center
            eyebrow="Por que o Prospeca"
            title={
              <>
                Prospecção simples
                <br />
                pra equipes enxutas
              </>
            }
            description="Do primeiro filtro ao fechamento, tudo acontece num lugar só. Os resultados aparecem no pipeline."
          />
        </AnimatedSection>

        <AnimatedSection className="mt-14 md:mt-16" delay={100}>
          <div className="relative mx-auto max-w-[860px]">
            {/* Crosshair lines */}
            <div
              className="pointer-events-none absolute left-1/2 top-[3%] bottom-[3%] w-px"
              style={{
                background:
                  "linear-gradient(180deg, transparent, oklch(0.92 0.007 95) 18%, oklch(0.92 0.007 95) 82%, transparent)",
              }}
            />
            <div
              className="pointer-events-none absolute top-1/2 left-[1%] right-[1%] h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent, oklch(0.92 0.007 95) 14%, oklch(0.92 0.007 95) 86%, transparent)",
              }}
            />
            {/* Center dot */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border-strong bg-surface shadow-sm ring-1 ring-border" />

            <div className="grid grid-cols-1 sm:grid-cols-2">
              {CELLS.map((cell, i) => (
                <div
                  key={cell.title}
                  className="group px-8 py-12 text-center sm:py-14"
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface shadow-card">
                    <cell.icon className="h-5 w-5 text-primary" />
                  </span>
                  <h3 className="mt-5 text-[15px] font-semibold text-foreground">
                    {cell.title}
                  </h3>
                  <p className="mx-auto mt-3 max-w-[260px] text-[13px] leading-relaxed text-muted-foreground">
                    {cell.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </AnimatedSection>
      </MarketingContainer>
    </section>
  );
}
