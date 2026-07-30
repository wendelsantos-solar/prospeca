import type { LucideIcon } from "lucide-react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AppIcon } from "./AppIcon";

/**
 * Tamanhos de área clicável — spec §7.
 * O ícone permanece centralizado; a área de hit cresce ao redor.
 */
const BUTTON_SIZE_CLASSES = {
  sm: "h-8 w-8", // 32×32px
  md: "h-9 w-9", // 36×36px
  lg: "h-10 w-10", // 40×40px
} as const;

/**
 * Variantes visuais — spec §8.
 */
const VARIANT_CLASSES: Record<string, string> = {
  ghost:
    "text-muted-foreground hover:bg-surface-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
  outline:
    "border border-border text-foreground hover:bg-surface-hover hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring",
  soft: "bg-primary-soft text-primary hover:bg-primary-subtle focus-visible:ring-2 focus-visible:ring-ring",
  primary:
    "bg-primary text-primary-foreground hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-ring",
  danger:
    "text-destructive hover:bg-destructive-soft hover:text-destructive focus-visible:ring-2 focus-visible:ring-destructive",
};

export interface IconButtonProps {
  /** Ícone Lucide (preferencialmente do `icon-registry`) */
  icon: LucideIcon;
  /** Rótulo acessível — obrigatório para botões de ícone — spec §8 */
  label: string;
  /** Tamanho da área clicável */
  size?: keyof typeof BUTTON_SIZE_CLASSES;
  /** Variante visual */
  variant?: keyof typeof VARIANT_CLASSES;
  /** Tamanho do ícone dentro do botão */
  iconSize?: "sm" | "md" | "lg";
  /** Se true, mostra spinner e desabilita */
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
  /** Tooltip textual — spec §10. Se omitido, usa `label`. */
  tooltip?: string;
}

/**
 * Botão de ícone isolado — spec §8.
 *
 * Garante área clicável adequada, foco visível, estado disabled/loading,
 * aria-label e tooltip.
 *
 * @example
 * <IconButton
 *   icon={icons.actions.filter}
 *   label="Abrir filtros"
 *   variant="ghost"
 *   size="md"
 * />
 */
export function IconButton({
  icon,
  label,
  size = "md",
  variant = "ghost",
  iconSize = "md",
  loading,
  disabled,
  onClick,
  type = "button",
  className,
  tooltip,
}: IconButtonProps) {
  const isDisabled = disabled || loading;
  const sizeCls = BUTTON_SIZE_CLASSES[size];
  const variantCls = VARIANT_CLASSES[variant];

  const button = (
    <button
      type={type}
      aria-label={label}
      disabled={isDisabled}
      onClick={onClick}
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-lg transition-colors duration-150",
        "focus-visible:outline-none",
        isDisabled && "pointer-events-none opacity-50",
        sizeCls,
        variantCls,
        className,
      )}
    >
      {loading ? (
        <AppIcon
          icon={LoaderCircle}
          size={iconSize}
          tone="muted"
          className="animate-spin"
          decorative
        />
      ) : (
        <AppIcon icon={icon} size={iconSize} decorative />
      )}
    </button>
  );

  const tip = tooltip ?? label;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}
