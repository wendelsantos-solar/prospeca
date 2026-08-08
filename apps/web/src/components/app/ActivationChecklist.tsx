import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowRight, Check, ChevronDown, ListChecks, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useActivationStore, type ActivationMilestone } from "@/stores/activation";

const TASKS: Array<{
  key: ActivationMilestone;
  title: string;
  description: string;
  to: "/app/mapa" | "/app/kanban";
}> = [
  {
    key: "firstSearch",
    title: "Encontre suas primeiras oportunidades",
    description: "Escolha um nicho e uma região.",
    to: "/app/mapa",
  },
  {
    key: "firstLeadViewed",
    title: "Abra os detalhes de uma empresa",
    description: "Veja os sinais que explicam o score.",
    to: "/app/mapa",
  },
  {
    key: "firstLeadAdded",
    title: "Adicione uma empresa ao pipeline",
    description: "Transforme descoberta em ação comercial.",
    to: "/app/mapa",
  },
  {
    key: "firstMessagePrepared",
    title: "Prepare o primeiro contato",
    description: "Revise a mensagem antes de abrir o WhatsApp.",
    to: "/app/kanban",
  },
];

interface ChecklistPreference {
  collapsed: boolean;
  dismissed: boolean;
}

const PREFERENCE_KEY = "rl-activation-checklist";

function loadPreference(): ChecklistPreference {
  try {
    const saved = localStorage.getItem(PREFERENCE_KEY);
    if (!saved) return { collapsed: false, dismissed: false };
    const parsed = JSON.parse(saved) as Partial<ChecklistPreference>;
    return {
      collapsed: parsed.collapsed === true,
      dismissed: parsed.dismissed === true,
    };
  } catch {
    return { collapsed: false, dismissed: false };
  }
}

function savePreference(preference: ChecklistPreference) {
  try {
    localStorage.setItem(PREFERENCE_KEY, JSON.stringify(preference));
  } catch {
    // Device preference only; the checklist remains usable without persistence.
  }
}

export function ActivationChecklist() {
  const milestones = useActivationStore((state) => state.milestones);
  const hydrated = useActivationStore((state) => state.hydrated);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [preference, setPreference] = useState<ChecklistPreference | null>(null);
  const completed = TASKS.filter((task) => milestones[task.key]).length;
  const nextTask = TASKS.find((task) => !milestones[task.key]);

  useEffect(() => {
    setPreference((current) => {
      const loaded = current ?? loadPreference();
      const shouldCollapse = pathname !== "/app/mapa" || completed > 1;
      if (!shouldCollapse || loaded.collapsed) return loaded;
      const next = { ...loaded, collapsed: true };
      savePreference(next);
      return next;
    });
  }, [completed, pathname]);

  const updatePreference = (patch: Partial<ChecklistPreference>) => {
    setPreference((current) => {
      const next = { ...(current ?? loadPreference()), ...patch };
      savePreference(next);
      return next;
    });
  };

  if (!hydrated || !preference || preference.dismissed || completed === TASKS.length) return null;

  const open = !preference.collapsed;

  return (
    <section
      className={cn(
        "mx-3 my-3 shrink-0 rounded-xl border border-primary/15 bg-surface transition-shadow",
        open ? "shadow-card" : "shadow-sm",
      )}
      aria-label="Primeiros passos na Prospeca"
    >
      <div className={cn("flex items-center gap-3 px-4", open ? "py-3" : "py-2.5")}>
        <div
          className={cn(
            "grid shrink-0 place-items-center rounded-lg bg-primary-soft text-primary",
            open ? "h-9 w-9" : "h-8 w-8",
          )}
        >
          <ListChecks className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-[13px] font-semibold text-foreground">
              {open ? "Primeiros passos" : `Próximo passo: ${nextTask?.title ?? "Continuar"}`}
            </p>
            <span
              className="shrink-0 text-[11px] font-medium text-muted-foreground tabular-nums"
              aria-live="polite"
            >
              {completed} de {TASKS.length}
            </span>
          </div>
          <Progress value={(completed / TASKS.length) * 100} className="mt-1.5 h-1.5" />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => updatePreference({ collapsed: open })}
          aria-label={open ? "Recolher primeiros passos" : "Expandir primeiros passos"}
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", !open && "-rotate-90")} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          onClick={() => updatePreference({ dismissed: true })}
          aria-label="Fechar primeiros passos"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {open && (
        <div className="grid border-t border-border/70 md:grid-cols-2 xl:grid-cols-4">
          {TASKS.map((task, index) => {
            const done = milestones[task.key];
            return (
              <Link
                key={task.key}
                to={task.to}
                onClick={() => updatePreference({ collapsed: true })}
                aria-label={`Ir para a etapa: ${task.title}`}
                className={cn(
                  "group flex min-w-0 items-start gap-2.5 px-4 py-3 transition-colors hover:bg-surface-hover",
                  index > 0 && "border-t border-border/70 md:border-t-0 md:border-l",
                  index === 2 && "md:border-l-0 md:border-t xl:border-l xl:border-t-0",
                  done && "opacity-60",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] font-semibold",
                    done
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface text-muted-foreground",
                  )}
                >
                  {done ? <Check className="h-3 w-3" aria-hidden /> : index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-medium text-foreground">
                    {task.title}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                    {task.description}
                  </span>
                </span>
                {!done && (
                  <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                )}
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
