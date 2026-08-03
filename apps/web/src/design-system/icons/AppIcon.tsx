import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Escala de tamanhos canônica — spec §4.
 * Não usar tamanhos fora desta escala sem justificativa excepcional.
 */
const SIZE_CLASSES = {
  xs: "h-3 w-3", // 12px — metadados e indicadores muito pequenos
  sm: "h-3.5 w-3.5", // 14px — badges e inputs compactos
  md: "h-4 w-4", // 16px — tamanho padrão de interface
  lg: "h-[18px] w-[18px]", // 18px — navegação e ações principais
  xl: "h-5 w-5", // 20px — títulos de seções e empty states
  display: "h-6 w-6", // 24px — ilustrações simples e métricas
} as const;

/**
 * Espessura do traço — spec §5.
 * Mapeia para o strokeWidth da Lucide.
 */
const STROKE_WIDTHS = {
  light: 1.5, // metadados e controles muito discretos
  regular: 1.75, // ações e navegação padrão
  strong: 2, // alertas ou ações que precisam de maior presença
} as const;

/**
 * Mapa de tons semânticos → classes Tailwind.
 * Usa os tokens de cor do Design System (styles.css).
 */
const TONE_CLASSES: Record<string, string> = {
  default: "text-foreground",
  muted: "text-muted-foreground",
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning-foreground",
  danger: "text-destructive",
  info: "text-info",
  inverse: "text-primary-foreground",
};

export interface AppIconProps {
  /** Ícone Lucide (preferencialmente do `icon-registry`) */
  icon: LucideIcon;
  /** Tamanho canônico — spec §4 */
  size?: keyof typeof SIZE_CLASSES;
  /** Tom semântico — spec §6. Use "inherit" para herdar cor do elemento pai. */
  tone?: keyof typeof TONE_CLASSES | "inherit";
  /** Espessura do traço — spec §5 */
  stroke?: keyof typeof STROKE_WIDTHS;
  /** Se true, renderiza com aria-hidden (ícone puramente decorativo) — spec §36 */
  decorative?: boolean;
  /** Rótulo acessível para ícones que transmitem informação — spec §36 */
  label?: string;
  /** Classes adicionais (ex.: margens, animações) */
  className?: string;
}

/**
 * Componente base de ícone da Prospeca.
 *
 * Centraliza tamanho, stroke, cor, acessibilidade e alinhamento.
 * Consumir preferencialmente via `icon-registry.ts`.
 *
 * @example
 * <AppIcon icon={icons.actions.search} size="md" tone="muted" />
 * <AppIcon icon={icons.feedback.warning} label="Atenção: atividade atrasada" />
 */
export function AppIcon({
  icon: Icon,
  size = "md",
  tone = "default",
  stroke = "regular",
  decorative,
  label,
  className,
}: AppIconProps) {
  const sizeCls = SIZE_CLASSES[size];
  const toneCls = tone === "inherit" ? "" : TONE_CLASSES[tone];
  const sw = STROKE_WIDTHS[stroke];

  return (
    <Icon
      className={cn(sizeCls, toneCls, "shrink-0", className)}
      strokeWidth={sw}
      aria-hidden={decorative ? true : label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    />
  );
}
