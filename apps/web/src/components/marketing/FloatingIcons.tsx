import {
  TrendingUp,
  GitBranch,
  FileSpreadsheet,
  MessageCircle,
  Search,
  MapPin,
  Building2,
} from "lucide-react";
import { GoogleIcon, WhatsAppIcon } from "./brand-icons";

/**
 * Orbital constellation — SVG ellipses with white circular badges at precise
 * points. All elements share one coordinate system inside a centered container,
 * so badges always land exactly on the orbit lines regardless of screen size.
 *
 * 8 badges at 45° intervals on the outer ellipse.
 */

const VB_W = 1200;
const VB_H = 900;
const CX = VB_W / 2;
const CY = VB_H / 2;

// Outer ellipse (badges here)
const RX = 520;
const RY = 360;

interface Badge {
  icon: React.ReactNode;
  label: string;
  angle: number;
  delay: string;
  size: number; // px
}

function orbit(angleDeg: number) {
  const r = (angleDeg * Math.PI) / 180;
  return {
    x: CX + RX * Math.sin(r),
    y: CY - RY * Math.cos(r),
  };
}

const BADGES: Badge[] = [
  {
    icon: <Search className="h-5 w-5 text-foreground" />,
    label: "Pesquisa",
    angle: 0,
    delay: "0s",
    size: 52,
  },
  {
    icon: <WhatsAppIcon className="h-5 w-5" />,
    label: "WhatsApp",
    angle: 45,
    delay: "0.6s",
    size: 44,
  },
  {
    icon: <MapPin className="h-5 w-5 text-[#ea4335]" />,
    label: "Google Maps",
    angle: 90,
    delay: "1.2s",
    size: 60,
  },
  {
    icon: <Building2 className="h-5 w-5 text-foreground" />,
    label: "Empresas",
    angle: 135,
    delay: "1.8s",
    size: 48,
  },
  {
    icon: <MessageCircle className="h-5 w-5 text-foreground" />,
    label: "Mensagens",
    angle: 180,
    delay: "2.4s",
    size: 52,
  },
  {
    icon: <FileSpreadsheet className="h-5 w-5 text-[#34a853]" />,
    label: "Exporta CSV",
    angle: 225,
    delay: "3.0s",
    size: 44,
  },
  {
    icon: <GitBranch className="h-5 w-5 text-foreground" />,
    label: "Pipeline",
    angle: 270,
    delay: "3.6s",
    size: 56,
  },
  {
    icon: <TrendingUp className="h-5 w-5 text-foreground" />,
    label: "Score",
    angle: 315,
    delay: "4.2s",
    size: 48,
  },
];

export function FloatingIcons() {
  return (
    <div className="pointer-events-none absolute inset-0 hidden md:block" aria-hidden="true">
      {/* ── Centered container with aspect ratio matching viewBox ── */}
      <div
        className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          top: "var(--orbit-center-y, 46%)",
          width: "min(1200px, 94vw)",
          height: "calc(min(1200px, 94vw) * 0.75)",
        }}
      >
        {/* ── SVG orbit traces ── */}
        <svg
          className="absolute inset-0 overflow-visible"
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Outer orbit */}
          <ellipse
            cx={CX}
            cy={CY}
            rx={RX}
            ry={RY}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.7"
            className="text-border opacity-30"
          />
          {/* Middle orbit */}
          <ellipse
            cx={CX}
            cy={CY}
            rx={390}
            ry={260}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.7"
            className="text-border opacity-20"
          />
          {/* Inner orbit — subtle accent */}
          <ellipse
            cx={CX}
            cy={CY}
            rx={250}
            ry={160}
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            className="text-primary/12"
          />
        </svg>

        {/* ── Badges ── */}
        {BADGES.map((b) => {
          const p = orbit(b.angle);
          return (
            <div
              key={b.label}
              className="animate-float-slow absolute flex flex-col items-center gap-1"
              style={{
                left: `${(p.x / VB_W) * 100}%`,
                top: `${(p.y / VB_H) * 100}%`,
                animationDelay: b.delay,
              }}
            >
              {/* White circle badge */}
              <div
                className="flex items-center justify-center rounded-full bg-white"
                style={{
                  width: b.size,
                  height: b.size,
                  border: "1px solid rgba(15, 23, 42, 0.06)",
                  boxShadow: "0 6px 20px rgba(15, 23, 42, 0.05), 0 1px 3px rgba(15, 23, 42, 0.03)",
                }}
              >
                {b.icon}
              </div>
              {/* Label below */}
              <span
                className="text-[10px] font-medium whitespace-nowrap rounded-full px-2 py-0.5"
                style={{ color: "var(--color-muted-foreground)" }}
              >
                {b.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
