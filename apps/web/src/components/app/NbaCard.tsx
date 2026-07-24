import { MessageCircle, PhoneCall, Mail, Sparkles, Clock, ArrowRight } from "lucide-react";
import type { Lead } from "@/types";
import { computeNba, type NbaChannel, type NbaPriority } from "@/lib/nba";
import { useOutbound } from "@/hooks/useOutbound";
import { useLeadsStore } from "@/stores";
import { cn } from "@/lib/utils";

const CHANNEL_ICON: Record<NbaChannel, React.ComponentType<{ className?: string }>> = {
  whatsapp: MessageCircle,
  call: PhoneCall,
  email: Mail,
  system: Sparkles,
};

const PRIORITY_STYLES: Record<NbaPriority, string> = {
  high: "bg-primary text-primary-foreground",
  medium: "bg-warning/15 text-warning",
  low: "bg-muted text-muted-foreground",
};

const PRIORITY_LABEL: Record<NbaPriority, string> = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

export function NbaCard({ lead }: { lead: Lead }) {
  const setDetails = useLeadsStore((s) => s.setDetails);
  const { openWhatsApp } = useOutbound();
  const nba = computeNba(lead);
  const Icon = CHANNEL_ICON[nba.channel];

  async function handleCta() {
    // Refused (no WhatsApp / opt-out) → fall back to the drawer, as before.
    if (nba.channel === "whatsapp" && (await openWhatsApp(lead))) return;
    setDetails(lead.id);
  }

  return (
    <div className="mb-4 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
              Próxima melhor ação
            </span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                PRIORITY_STYLES[nba.priority],
              )}
            >
              {PRIORITY_LABEL[nba.priority]}
            </span>
          </div>
          <div className="mt-1 text-[14px] font-semibold text-foreground">{nba.action}</div>
          <p className="mt-0.5 text-[12px] text-muted-foreground">{nba.reason}</p>
          {nba.daysSinceContact !== null && (
            <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              Último contato há {nba.daysSinceContact} {nba.daysSinceContact === 1 ? "dia" : "dias"}
            </div>
          )}
        </div>
      </div>
      <div className="mt-3">
        <button
          onClick={handleCta}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90"
        >
          {nba.cta}
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
