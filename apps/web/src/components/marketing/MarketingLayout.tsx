import type { ReactNode } from "react";
import { MarketingHeader } from "./MarketingHeader";
import { MarketingFooter } from "./MarketingFooter";
import { cn } from "@/lib/utils";

/**
 * Container width tokens for marketing pages.
 * Narrow: text-heavy sections (720px)
 * Default: standard content (1120px)
 * Wide: comparisons, wide layouts (1280px)
 * Showcase: product demos, screenshots (1360px)
 */
type ContainerWidth = "narrow" | "default" | "wide" | "showcase";

const CONTAINER_CLASSES: Record<ContainerWidth, string> = {
  narrow: "max-w-[720px]",
  default: "max-w-6xl",
  wide: "max-w-7xl",
  showcase: "max-w-[1360px]",
};

export function MarketingContainer({
  width = "default",
  className,
  children,
}: {
  width?: ContainerWidth;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("mx-auto px-4 md:px-6 lg:px-8", CONTAINER_CLASSES[width], className)}>
      {children}
    </div>
  );
}

/**
 * Section spacing tokens.
 * sm: 64px — compact sections
 * md: 88px — standard sections
 * lg: 112px — major sections
 * xl: 136px — hero/final CTA
 */
type SectionSpacing = "sm" | "md" | "lg" | "xl";

const SECTION_SPACING: Record<SectionSpacing, string> = {
  sm: "py-16 md:py-20",
  md: "py-20 md:py-24",
  lg: "py-24 md:py-28",
  xl: "py-28 md:py-32",
};

interface MarketingSectionProps {
  id?: string;
  spacing?: SectionSpacing;
  muted?: boolean;
  className?: string;
  children: ReactNode;
}

export function MarketingSection({
  id,
  spacing = "md",
  muted = false,
  className,
  children,
}: MarketingSectionProps) {
  return (
    <section id={id} className={cn(SECTION_SPACING[spacing], muted && "bg-surface-2", className)}>
      {children}
    </section>
  );
}

/**
 * Eyebrow — small uppercase label above section titles.
 */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">{children}</p>
  );
}

/**
 * Section heading with optional eyebrow and description.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  center = false,
  className,
  as: Heading = "h2",
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  center?: boolean;
  className?: string;
  /** Heading level — defaults to h2. Pass "h1" for a section that is the page's main heading. */
  as?: "h1" | "h2";
}) {
  return (
    <div className={cn("max-w-2xl", center && "mx-auto text-center", className)}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <Heading className="text-[1.75rem] leading-tight font-semibold tracking-tight text-foreground md:text-[2.25rem]">
        {title}
      </Heading>
      {description && (
        <p className="mt-4 text-base text-muted-foreground md:text-lg">{description}</p>
      )}
    </div>
  );
}

interface MarketingPageProps {
  children: ReactNode;
  showHeader?: boolean;
  showFooter?: boolean;
}

export function MarketingPage({
  children,
  showHeader = true,
  showFooter = true,
}: MarketingPageProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:outline-none"
      >
        Pular para o conteúdo
      </a>
      {showHeader && <MarketingHeader />}
      <main id="main-content" className="flex-1">
        {children}
      </main>
      {showFooter && <MarketingFooter />}
    </div>
  );
}
