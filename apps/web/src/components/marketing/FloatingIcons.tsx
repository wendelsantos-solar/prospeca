import { Target, GitBranch, MessageCircle, MapPin, type LucideIcon } from "lucide-react";
import { GoogleIcon, WhatsAppIcon } from "./brand-icons";

interface FloatingIconSpec {
  Icon: LucideIcon | typeof GoogleIcon;
  top: string;
  left: string;
  delay: string;
  bg: string;
  iconClass: string;
}

/**
 * Icons orbiting the hero product demo. Only WhatsApp and Google represent
 * real integrations (wa.me deep link, Google OAuth login). MapPin is a
 * generic location glyph — not a reproduction of Google's Maps logo — and
 * the rest are conceptual (score, pipeline, messaging), matching what the
 * product actually does. No Google Calendar: that integration doesn't
 * exist yet.
 */
// Kept within 0-100% on both axes — the hero section has overflow-hidden,
// so anything positioned outside the container bounds gets clipped.
const ICONS: FloatingIconSpec[] = [
  {
    Icon: WhatsAppIcon,
    top: "6%",
    left: "2%",
    delay: "0s",
    bg: "bg-[#25D366]/10",
    iconClass: "text-[#25D366]",
  },
  {
    Icon: MapPin,
    top: "58%",
    left: "3%",
    delay: "0.6s",
    bg: "bg-primary-soft",
    iconClass: "text-primary",
  },
  { Icon: GoogleIcon, top: "88%", left: "12%", delay: "1.2s", bg: "bg-surface", iconClass: "" },
  {
    Icon: Target,
    top: "4%",
    left: "90%",
    delay: "0.3s",
    bg: "bg-primary-soft",
    iconClass: "text-primary",
  },
  {
    Icon: GitBranch,
    top: "52%",
    left: "97%",
    delay: "0.9s",
    bg: "bg-primary-soft",
    iconClass: "text-primary",
  },
  {
    Icon: MessageCircle,
    top: "86%",
    left: "84%",
    delay: "1.5s",
    bg: "bg-primary-soft",
    iconClass: "text-primary",
  },
];

export function FloatingIcons() {
  return (
    <div className="pointer-events-none absolute inset-0 hidden md:block" aria-hidden="true">
      {ICONS.map(({ Icon, top, left, delay, bg, iconClass }, i) => (
        <div
          key={i}
          className={`animate-float absolute grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-border shadow-elevated ${bg}`}
          style={{ top, left, animationDelay: delay }}
        >
          <Icon className={`h-5 w-5 ${iconClass}`} />
        </div>
      ))}
    </div>
  );
}
