import {
  Check,
  Clock,
  MessageCircle,
  Phone,
  Users,
  RotateCw,
  FileText,
  MapPin,
  Sparkles,
} from "lucide-react";
import type { ActivityType, Lead, LeadActivity } from "@/types";
import { useCompleteActivityMutation } from "@/hooks/useLeadsQuery";
import { useLeadsStore } from "@/stores";
import { formatDate, formatDateTime, digitsOnly } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const ICONS: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  call: Phone,
  message: MessageCircle,
  meeting: Users,
  followup: RotateCw,
  proposal: FileText,
  visit: MapPin,
  other: Sparkles,
};

const TYPE_LABELS: Record<ActivityType, string> = {
  call: "Ligação",
  message: "Mensagem",
  meeting: "Reunião",
  followup: "Retorno",
  proposal: "Proposta",
  visit: "Visita",
  other: "Outra",
};

const PRIORITY_STYLES: Record<"low" | "medium" | "high", string> = {
  high: "bg-primary text-primary-foreground",
  medium: "bg-warning/15 text-warning",
  low: "bg-muted text-muted-foreground",
};

const PRIORITY_LABEL: Record<"low" | "medium" | "high", string> = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

export function ActivityItem({ lead, activity }: { lead: Lead; activity: LeadActivity }) {
  const setDetails = useLeadsStore((s) => s.setDetails);
  const completeMutation = useCompleteActivityMutation();
  const Icon = ICONS[activity.type] ?? Sparkles;

  function toggleDone() {
    completeMutation.mutate({ leadId: lead.id, activityId: activity.id, done: !activity.done });
    toast.success(activity.done ? "Atividade reaberta" : "Atividade concluída");
  }

  function openChannel() {
    if (activity.type === "message") {
      const num = digitsOnly(lead.whatsapp ?? lead.phone);
      if (num) {
        window.open(`https://wa.me/${num}`, "_blank");
        return;
      }
    }
    if (activity.type === "call" && lead.phone) {
      window.open(`tel:${lead.phone}`, "_self");
      return;
    }
    setDetails(lead.id);
  }

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-lg border border-border bg-surface p-3 transition-colors hover:border-border-strong",
      )}
    >
      <div
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-md",
          activity.done ? "bg-muted text-muted-foreground" : "bg-primary-soft text-primary",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <button
          onClick={() => setDetails(lead.id)}
          className={cn(
            "block max-w-full truncate text-left text-[13px] font-semibold text-foreground hover:text-primary",
            activity.done && "line-through text-muted-foreground",
          )}
        >
          {activity.title}
        </button>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <span>{TYPE_LABELS[activity.type] ?? "Ação"}</span>
          {activity.priority && (
            <>
              <span>·</span>
              <span
                className={cn(
                  "rounded px-1 py-0.5 text-[10px] font-semibold",
                  PRIORITY_STYLES[activity.priority],
                )}
              >
                {PRIORITY_LABEL[activity.priority]}
              </span>
            </>
          )}
        </div>
        <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {activity.time
            ? formatDateTime(`${activity.date}T${activity.time}`)
            : formatDate(activity.date)}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {!activity.done && (
          <button
            onClick={openChannel}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11.5px] font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {activity.type === "message" ? "Abordar" : activity.type === "call" ? "Ligar" : "Abrir"}
          </button>
        )}
        <button
          onClick={toggleDone}
          aria-label={activity.done ? "Reabrir" : "Concluir"}
          aria-pressed={activity.done}
          className={cn(
            "grid h-7 w-7 place-items-center rounded-md border text-muted-foreground hover:border-border-strong hover:text-foreground",
            activity.done
              ? "border-primary bg-primary-soft text-primary"
              : "border-border bg-surface",
          )}
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
