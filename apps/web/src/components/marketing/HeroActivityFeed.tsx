import { useState, useEffect, useRef } from "react";
import { TrendingUp, MessageCircle, CalendarCheck, Star } from "lucide-react";
import { DEMO_LEADS } from "@/marketing/demo-data";
import { cn } from "@/lib/utils";

/**
 * HeroActivityFeed — rotating activity cards that show the product "in action."
 *
 * Three cards cycle through 3 visible stack positions + 1 off-screen slot
 * using JS-driven CSS transitions (not keyframes!). This avoids the
 * "dead zone" stutter that pure CSS keyframes cause at the loop point.
 *
 * Architecture:
 *   - currentIndex rotates (0→1→2→0…) every 2.8s via setInterval
 *   - Each card is assigned a slot based on its distance from currentIndex:
 *       slot 0 = front   (full scale, full opacity)
 *       slot 1 = middle  (slightly smaller, translucent)
 *       slot 2 = back    (smallest, most translucent)
 *       slot 3 = off-screen above (entering) — only during handoff
 *   - CSS transitions on transform & opacity handle the movement
 */

const hotLead = DEMO_LEADS[0]; // Rústica Barbearia — Score 89
const contactedLead = DEMO_LEADS[2]; // Studio Aurora — Score 64
const wonLead = DEMO_LEADS[5]; // Doce Confeitaria — Score 72

interface ActivityCard {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  detail: string;
  time: string;
}

const ACTIVITIES: ActivityCard[] = [
  {
    icon: (
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-hot-soft text-hot">
        <TrendingUp className="h-4 w-4" />
      </div>
    ),
    title: `${hotLead.companyName}`,
    subtitle: `Score ${hotLead.score} · ${hotLead.category}`,
    detail: "Não possui site · WhatsApp e telefone encontrados",
    time: "agora",
  },
  {
    icon: (
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-stage-contacted-soft text-stage-contacted">
        <MessageCircle className="h-4 w-4" />
      </div>
    ),
    title: `${contactedLead.companyName}`,
    subtitle: `Lead contatado · ${contactedLead.contactName}`,
    detail: "Mensagem enviada via WhatsApp · Aguardando resposta",
    time: "2 min",
  },
  {
    icon: (
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-stage-won-soft text-stage-won">
        <CalendarCheck className="h-4 w-4" />
      </div>
    ),
    title: `${wonLead.companyName}`,
    subtitle: `Negócio fechado · R$ ${wonLead.estimatedValue?.toLocaleString("pt-BR")}`,
    detail: `${wonLead.contactName} aceitou a proposta · Movido para Ganho`,
    time: "5 min",
  },
];

/**
 * Visual definition for each stack slot.
 * The front slot has no offset and full opacity;
 * middle and back cascade down with decreasing scale and opacity.
 */
interface SlotStyle {
  y: number; // translateY in px
  scale: number;
  opacity: number;
  zIndex: number;
}

const SLOTS: Record<number, SlotStyle> = {
  0: { y: 0, scale: 1, opacity: 1, zIndex: 30 }, // front
  1: { y: 10, scale: 0.97, opacity: 0.72, zIndex: 20 }, // middle
  2: { y: 20, scale: 0.94, opacity: 0.38, zIndex: 10 }, // back
  3: { y: -38, scale: 0.92, opacity: 0, zIndex: 5 }, // off-screen (entering from above)
};

const INTERVAL_MS = 2800;

export function HeroActivityFeed() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      if (pausedRef.current) return;
      setCurrentIndex((prev) => (prev + 1) % ACTIVITIES.length);
    }, INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  /** Pause rotation while the user hovers the stack */
  const handleMouseEnter = () => { pausedRef.current = true; };
  const handleMouseLeave = () => { pausedRef.current = false; };

  /**
   * Determine which slot a card is in based on its index relative to
   * the current "front" card. The front card is at distance 0, the
   * next at distance 1, the last at distance 2.
   *
   * When the front card changes, the old front card moves to slot 3
   * (off-screen) briefly before being re-assigned — but since React
   * re-renders synchronously on state change, the card goes directly
   * to its new slot and CSS transitions handle the visual movement.
   */
  function getSlot(cardIndex: number): number {
    const distance = (cardIndex - currentIndex + ACTIVITIES.length) % ACTIVITIES.length;
    return distance; // 0, 1, or 2
  }

  return (
    <div className="relative mx-auto mt-10 w-full max-w-[380px] sm:mt-12" aria-hidden="true">
      <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        Atividade ao vivo
      </p>

      {/* Subtle green glow behind the stack */}
      <div
        className="pointer-events-none absolute left-1/2 top-[45%] h-[200px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(22,163,74,0.14) 0%, rgba(22,163,74,0.05) 38%, transparent 72%)",
          filter: "blur(44px)",
        }}
      />

      {/* Stack container */}
      <div
        className="relative"
        style={{ height: "170px" }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {ACTIVITIES.map((activity, i) => {
          const slot = getSlot(i);
          const style = SLOTS[slot];

          return (
            <div
              key={i}
              className={cn(
                "absolute left-0 right-0 flex items-start gap-3 rounded-xl border border-border bg-surface p-3.5 shadow-card",
                "transition-all duration-[600ms] ease-out",
              )}
              style={{
                transform: `translateY(${style.y}px) scale(${style.scale})`,
                opacity: style.opacity,
                zIndex: style.zIndex,
              }}
            >
              {activity.icon}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] font-semibold text-foreground">
                    {activity.title}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {activity.time}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {activity.subtitle}
                </p>
                <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-surface-2 px-2 py-1 text-[10px] text-muted-foreground">
                  <Star className="h-2.5 w-2.5 text-primary" />
                  {activity.detail}
                </div>
              </div>
            </div>
          );
        })}
        </div>
    </div>
  );
}
