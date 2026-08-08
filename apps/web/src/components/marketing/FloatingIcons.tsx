import { MapPin, TrendingUp, GitBranch, FileSpreadsheet, MessageCircle } from "lucide-react";
import { GoogleIcon, WhatsAppIcon } from "./brand-icons";

/**
 * Integration orbit — badges positioned in an elliptical pattern around
 * the hero headline, exactly like Kaptto's ".ob" constellation.
 *
 * Reference point: left 50% / top 45% (hero content center).
 * Each badge is offset by a calc() expression to create the orbit.
 *
 * On mobile (<900px) the orbit is hidden to keep the hero clean.
 */

interface BadgeSpec {
  icon: React.ReactNode;
  label: string;
  /** Horizontal offset from center — negative = left, positive = right */
  x: string;
  /** Vertical offset from center — negative = up, positive = down */
  y: string;
  /** Animation delay for the float */
  delay: string;
  /** Extra classes */
  className?: string;
}

const BADGES: BadgeSpec[] = [
  // ── Left side (counter-clockwise) ──
  {
    icon: <WhatsAppIcon className="h-4 w-4" />,
    label: "WhatsApp",
    x: "calc(50% - min(300px, 40vw))",
    y: "calc(45% - 170px)",
    delay: "0s",
  },
  {
    icon: <MapPin className="h-4 w-4 text-[#ea4335]" />,
    label: "Google Maps",
    x: "calc(50% - min(440px, 40vw))",
    y: "calc(45% - 10px)",
    delay: "0.5s",
  },
  {
    icon: <FileSpreadsheet className="h-4 w-4 text-[#34a853]" />,
    label: "Exporta pra Sheets",
    x: "calc(50% - min(300px, 40vw))",
    y: "calc(45% + 150px)",
    delay: "1.0s",
  },

  // ── Right side (clockwise) ──
  {
    icon: <TrendingUp className="h-4 w-4 text-primary" />,
    label: "Score 0-100",
    x: "calc(50% + min(300px, 40vw))",
    y: "calc(45% - 170px)",
    delay: "0.25s",
  },
  {
    icon: <GitBranch className="h-4 w-4 text-primary" />,
    label: "Pipeline visual",
    x: "calc(50% + min(440px, 40vw))",
    y: "calc(45% - 10px)",
    delay: "0.75s",
  },
  {
    icon: <MessageCircle className="h-4 w-4 text-primary" />,
    label: "Mensagens prontas",
    x: "calc(50% + min(300px, 40vw))",
    y: "calc(45% + 150px)",
    delay: "1.25s",
  },
  {
    icon: <GoogleIcon className="h-4 w-4" />,
    label: "Google login",
    x: "calc(50% + min(440px, 40vw))",
    y: "calc(45% + 120px)",
    delay: "1.5s",
  },
];

export function FloatingIcons() {
  return (
    <div className="pointer-events-none absolute inset-0 hidden md:block" aria-hidden="true">
      {BADGES.map((badge) => (
        <div
          key={badge.label}
          className="animate-float absolute flex items-center gap-1.5 rounded-full border border-border/60 bg-surface/90 px-2.5 py-1.5 shadow-card backdrop-blur-sm"
          style={{
            left: badge.x,
            top: badge.y,
            transform: "translate(-50%, -50%)",
            animationDelay: badge.delay,
          }}
        >
          {badge.icon}
          <span className="text-[10px] font-medium whitespace-nowrap text-foreground">
            {badge.label}
          </span>
        </div>
      ))}
    </div>
  );
}
