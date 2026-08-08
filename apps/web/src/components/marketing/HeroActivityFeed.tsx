import { TrendingUp, MessageCircle, CalendarCheck, Star, MapPin } from "lucide-react";
import { DEMO_LEADS } from "@/marketing/demo-data";

/**
 * HeroActivityFeed — 3 stacked cards that rotate continuously using pure CSS
 * keyframes. The front card is full opacity/scale, the middle card is slightly
 * smaller and translucent, the back card is barely visible.
 *
 * Creates the "live activity" illusion — like notifications happening in the
 * product right now, matching Kaptto's stacked notification cards.
 */

const hotLead = DEMO_LEADS[0];
const contactedLead = DEMO_LEADS[2];
const wonLead = DEMO_LEADS[5];

const CARDS = [
  {
    color: "bg-hot-soft text-hot",
    icon: <TrendingUp className="h-3.5 w-3.5" />,
    title: `${hotLead.companyName}`,
    subtitle: `Score ${hotLead.score} · ${hotLead.category}`,
    detail: "Não possui site · WhatsApp encontrado · Alta oportunidade",
    time: "agora",
  },
  {
    color: "bg-stage-contacted-soft text-stage-contacted",
    icon: <MessageCircle className="h-3.5 w-3.5" />,
    title: `${contactedLead.companyName}`,
    subtitle: `Lead contatado · ${contactedLead.contactName}`,
    detail: "Mensagem enviada via WhatsApp · Aguardando resposta",
    time: "2 min",
  },
  {
    color: "bg-stage-won-soft text-stage-won",
    icon: <CalendarCheck className="h-3.5 w-3.5" />,
    title: `${wonLead.companyName}`,
    subtitle: `Negócio fechado · R$ ${wonLead.estimatedValue?.toLocaleString("pt-BR")}`,
    detail: `${wonLead.contactName} aceitou · Movido para Ganho`,
    time: "5 min",
  },
];

export function HeroActivityFeed() {
  return (
    <div className="relative mx-auto mt-10 w-full max-w-[400px]" aria-hidden="true">
      {/* Subtle green glow behind the stack */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[180px] w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(22,163,74,0.1) 0%, rgba(22,163,74,0.04) 40%, transparent 70%)",
          filter: "blur(36px)",
        }}
      />

      {/* Stack */}
      <div className="relative" style={{ height: "155px" }}>
        {CARDS.map((card, i) => (
          <div
            key={i}
            className={`animate-card-stack-${i + 1} absolute left-0 right-0 flex items-start gap-3 rounded-xl border border-border/70 bg-surface p-3.5 shadow-card`}
          >
            <div
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${card.color}`}
            >
              {card.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12.5px] font-semibold text-foreground">
                  {card.title}
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {card.time}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {card.subtitle}
              </p>
              <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-surface-2 px-2 py-1 text-[10px] text-muted-foreground">
                <Star className="h-2.5 w-2.5 text-primary" />
                {card.detail}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
