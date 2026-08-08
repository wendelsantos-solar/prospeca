import { TrendingUp, GitBranch, FileSpreadsheet, MessageCircle } from "lucide-react";
import { GoogleIcon, WhatsAppIcon } from "./brand-icons";

/**
 * Orbital constellation — SVG ellipses + badges sharing the same coordinate
 * system inside a single centered container.
 *
 * Container is centered at the headline position (--orbit-center-y from top,
 * 50% from left). Inside it, the SVG draws 3 concentric ellipses and the
 * badges are positioned absolutely using viewBox coordinates — so they always
 * sit exactly on the ellipse paths, at any screen size.
 */

interface BadgeSpec {
  icon: React.ReactNode;
  label: string;
  /** Position in viewBox space (0-1200, 0-900) */
  x: number;
  y: number;
  delay: string;
}

// ViewBox dimensions
const VB_W = 1200;
const VB_H = 900;
const CX = VB_W / 2; // 600
const CY = VB_H / 2; // 450

// Middle ellipse radii (where badges sit)
const RX = 440;
const RY = 280;

// Pre-compute badge positions at 60° intervals on the middle ellipse
function ellipsePoint(angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: CX + RX * Math.sin(rad),
    y: CY - RY * Math.cos(rad),
  };
}

const BADGES: BadgeSpec[] = [
  {
    icon: <TrendingUp className="h-4 w-4 text-primary" />,
    label: "Score 0-100",
    ...ellipsePoint(0),
    delay: "0s",
  },
  {
    icon: <WhatsAppIcon className="h-4 w-4" />,
    label: "WhatsApp",
    ...ellipsePoint(60),
    delay: "0.4s",
  },
  {
    icon: <GoogleIcon className="h-4 w-4" />,
    label: "Google Maps",
    ...ellipsePoint(120),
    delay: "0.8s",
  },
  {
    icon: <MessageCircle className="h-4 w-4 text-primary" />,
    label: "Mensagens",
    ...ellipsePoint(180),
    delay: "1.2s",
  },
  {
    icon: <FileSpreadsheet className="h-4 w-4 text-[#34a853]" />,
    label: "Exporta CSV",
    ...ellipsePoint(240),
    delay: "1.6s",
  },
  {
    icon: <GitBranch className="h-4 w-4 text-primary" />,
    label: "Pipeline",
    ...ellipsePoint(300),
    delay: "2.0s",
  },
];

export function FloatingIcons() {
  return (
    <div className="pointer-events-none absolute inset-0 hidden md:block" aria-hidden="true">
      {/*
        Single container, centered on the headline.
        SVG and badges share this coordinate origin, so the badges
        always land exactly on the ellipse paths regardless of screen size.
      */}
      <div
        className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          top: "var(--orbit-center-y, 18%)",
          // Aspect ratio = VB_W / VB_H = 4:3
          width: "min(1100px, 90vw)",
          height: "calc(min(1100px, 90vw) * 0.75)",
        }}
      >
        {/* ── SVG orbit traces ── */}
        <svg
          className="absolute inset-0 overflow-visible"
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Outer ellipse */}
          <ellipse
            cx={CX} cy={CY} rx={520} ry={340}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="1"
            opacity="0.35"
          />
          {/* Middle ellipse — badges on this ring */}
          <ellipse
            cx={CX} cy={CY} rx={RX} ry={RY}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="1"
            opacity="0.25"
          />
          {/* Inner ellipse — subtle accent */}
          <ellipse
            cx={CX} cy={CY} rx={340} ry={200}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="1.5"
            opacity="0.1"
            strokeDasharray="60 9999"
          />
        </svg>

        {/* ── Badges ── */}
        {BADGES.map((badge) => (
          <div
            key={badge.label}
            className="animate-float absolute flex items-center gap-2 rounded-full border border-border/60 bg-surface/90 px-3 py-2 shadow-card backdrop-blur-sm"
            style={{
              // Convert viewBox coords to percentage of container
              left: `${(badge.x / VB_W) * 100}%`,
              top: `${(badge.y / VB_H) * 100}%`,
              transform: "translate(-50%, -50%)",
              animationDelay: badge.delay,
            }}
          >
            {badge.icon}
            <span className="text-[11px] font-semibold whitespace-nowrap text-foreground">
              {badge.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
