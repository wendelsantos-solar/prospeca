// Onboarding wizard — guides new users to their first value.
// Retomável: users can skip and return later.
// Design: follows the app's design system (AppIcon, tokens, spacing).

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { AppIcon } from "@/design-system/icons/AppIcon";
import { icons } from "@/design-system/icons/icon-registry";
import type { LucideIcon } from "lucide-react";
import type { OnboardingProgress } from "@/hooks/useOnboarding";

// ── Step definitions ─────────────────────────────────────────────────

interface OnboardingStep {
  key: string;
  /** Icon from the design system registry (no emojis) */
  icon: LucideIcon;
  title: string;
  description: string;
}

const STEPS: OnboardingStep[] = [
  {
    key: "welcome",
    icon: icons.lead.opportunity, // Sparkles — descoberta de oportunidades
    title: "Bem-vindo à Prospeca",
    description:
      "Sua plataforma de inteligência comercial para descobrir e conquistar negócios locais na sua região.",
  },
  {
    key: "business_profile",
    icon: icons.lead.company, // Building2 — perfil da empresa
    title: "Conte sobre seu negócio",
    description:
      "Quanto mais soubermos sobre o que você vende, melhores serão as oportunidades sugeridas para você prospectar.",
  },
  {
    key: "first_search",
    icon: icons.actions.search, // Search — busca
    title: "Encontre empresas",
    description:
      "Escolha um nicho e uma região. A Prospeca busca empresas, analisa presença digital e calcula o score de oportunidade.",
  },
  {
    key: "explore",
    icon: icons.navigation.map, // Map — exploração no mapa
    title: "Analise as oportunidades",
    description:
      "Veja as empresas no mapa, confira telefone, WhatsApp, site, redes sociais e identifique as mais promissoras pelo score.",
  },
  {
    key: "pipeline",
    icon: icons.navigation.pipeline, // Columns3 — pipeline
    title: "Organize seu Pipeline",
    description:
      "Adicione leads ao Pipeline, prepare mensagens de abordagem e acompanhe cada oportunidade até fechar.",
  },
];

// ── Step indicator (horizontal: completed ● ── current ◉ ── upcoming ○) ─

function StepIndicator({
  steps,
  current,
  onSelect,
}: {
  steps: OnboardingStep[];
  current: number;
  onSelect: (index: number) => void;
}) {
  return (
    <nav aria-label="Progresso do onboarding" className="flex items-center justify-center gap-0">
      {steps.map((step, i) => {
        const isCompleted = i < current;
        const isCurrent = i === current;
        const isUpcoming = i > current;

        return (
          <div key={step.key} className="flex items-center">
            {/* Connector line (before, except first) */}
            {i > 0 && (
              <div
                className={cn(
                  "h-px w-6 sm:w-8 transition-colors",
                  i <= current ? "bg-primary" : "bg-border",
                )}
              />
            )}

            {/* Step circle */}
            <button
              type="button"
              onClick={() => onSelect(i)}
              className={cn(
                "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold transition-all",
                isCompleted &&
                  "bg-primary text-primary-foreground hover:bg-primary-hover cursor-pointer",
                isCurrent && "bg-primary text-primary-foreground ring-2 ring-primary/30",
                isUpcoming &&
                  "bg-muted text-muted-foreground hover:bg-surface-hover cursor-pointer",
              )}
              aria-current={isCurrent ? "step" : undefined}
              aria-label={`Passo ${i + 1}: ${step.title}${isCompleted ? " (concluído)" : ""}`}
            >
              {isCompleted ? (
                <AppIcon icon={icons.actions.confirm} size="xs" tone="inverse" decorative />
              ) : (
                i + 1
              )}
            </button>
          </div>
        );
      })}
    </nav>
  );
}

// ── Main component ───────────────────────────────────────────────────

export type { OnboardingProgress } from "@/hooks/useOnboarding";

interface OnboardingWizardProps {
  onComplete: (progress: OnboardingProgress) => void;
  onSkip: () => void;
  initialProgress?: OnboardingProgress;
  /** Storage is the caller's concern (localStorage in demo mode, the user's
   * profile row in real mode) — the wizard just reports what happened. */
  onSaveProgress: (progress: OnboardingProgress) => void;
}

export function OnboardingWizard({
  onComplete,
  onSkip,
  initialProgress,
  onSaveProgress,
}: OnboardingWizardProps) {
  const [step, setStep] = useState(initialProgress?.step ?? 0);
  const [skippedSteps, setSkippedSteps] = useState<string[]>(initialProgress?.skippedSteps ?? []);
  const [dismissed, setDismissed] = useState(initialProgress?.completed ?? false);
  const [exiting, setExiting] = useState(false);

  const currentStep = STEPS[step];
  const isFirstStep = step === 0;
  const isLastStep = step >= STEPS.length - 1;

  // Persist progress
  useEffect(() => {
    onSaveProgress({ step, completed: dismissed, skippedSteps });
    // onSaveProgress intentionally excluded: callers pass a fresh closure
    // each render, and it must not fire this effect on its own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, dismissed, skippedSteps]);

  // Track step view
  useEffect(() => {
    if (currentStep && !dismissed) {
      track("onboarding_started" as never, { step: currentStep.key, stepNumber: step + 1 });
    }
  }, [step, currentStep, dismissed]);

  const goTo = useCallback((index: number) => {
    if (index >= 0 && index < STEPS.length) setStep(index);
  }, []);

  const handleNext = useCallback(() => {
    if (isLastStep) {
      setExiting(true);
      // Save immediately (before animation delay) so a tab-close / refresh
      // during the exit animation doesn't lose the completed state.
      onSaveProgress({ step, completed: true, skippedSteps });
      track("onboarding_completed" as never, { totalSteps: STEPS.length });
      // Small delay for visual feedback before dismissing
      setTimeout(() => {
        setDismissed(true);
        onComplete({ step, completed: true, skippedSteps });
      }, 200);
    } else {
      setStep((s) => s + 1);
    }
  }, [isLastStep, step, skippedSteps, onComplete, onSaveProgress]);

  const handleSkip = useCallback(() => {
    const remaining = STEPS.slice(step + 1).map((s) => s.key);
    const allSkipped = [...skippedSteps, currentStep.key, ...remaining];
    setSkippedSteps(allSkipped);
    onSaveProgress({ step, completed: true, skippedSteps: allSkipped });
    track("onboarding_skipped" as never, { step: currentStep.key, stepNumber: step + 1 });
    setDismissed(true);
    onSkip();
  }, [step, skippedSteps, currentStep, onSkip, onSaveProgress]);

  if (dismissed) return null;

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface shadow-elevated transition-opacity duration-200",
        exiting && "opacity-0",
      )}
    >
      <div className="p-5 sm:p-6">
        {/* ── Step indicator (top) ─────────────────────────────────── */}
        <StepIndicator steps={STEPS} current={step} onSelect={goTo} />

        {/* ── Step content ─────────────────────────────────────────── */}
        <div className="mt-5 flex flex-col items-center text-center">
          {/* Illustrative icon */}
          <div className="mb-4 grid h-14 w-14 place-items-center rounded-xl bg-primary-soft">
            <AppIcon
              icon={currentStep.icon}
              size="display"
              tone="primary"
              stroke="light"
              decorative
            />
          </div>

          {/* Title + description */}
          <h2 className="text-[16px] font-semibold text-foreground">{currentStep.title}</h2>
          <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-muted-foreground">
            {currentStep.description}
          </p>
        </div>

        {/* ── Actions ──────────────────────────────────────────────── */}
        <div className="mt-5 flex items-center justify-between gap-3">
          {/* Left: Back + Skip */}
          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => goTo(step - 1)}
                className="text-muted-foreground"
              >
                <AppIcon icon={icons.directional.chevronLeft} size="sm" tone="inherit" decorative />
                <span className="ml-1">Voltar</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="text-muted-foreground"
            >
              Pular
            </Button>
          </div>

          {/* Right: Next / Finish */}
          <Button size="sm" onClick={handleNext}>
            {isLastStep ? (
              <>
                Começar a usar
                <AppIcon
                  icon={icons.navigation.opportunities}
                  size="sm"
                  tone="inverse"
                  decorative
                  className="ml-1.5"
                />
              </>
            ) : (
              <>
                Próximo
                <AppIcon
                  icon={icons.directional.chevronRight}
                  size="sm"
                  tone="inverse"
                  decorative
                  className="ml-1"
                />
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ── Footer: completion message ─────────────────────────────── */}
      <div className="rounded-b-xl border-t border-border bg-surface-2 px-5 py-2.5 text-center sm:px-6">
        <p className="text-[11px] text-muted-foreground">
          Você pode retomar depois em{" "}
          <span className="font-medium text-foreground">Configurações</span>.
        </p>
      </div>
    </div>
  );
}
