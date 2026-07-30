import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AppIcon } from "@/design-system/icons/AppIcon";
import { icons } from "@/design-system/icons/icon-registry";

export function ErrorState({
  title,
  description,
  onRetry,
  onSecondary,
  secondaryLabel,
  onBack,
  className,
}: {
  title: string;
  description?: string;
  onRetry?: () => void;
  onSecondary?: () => void;
  secondaryLabel?: string;
  onBack?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-10 px-6 text-center",
        className,
      )}
    >
      <div className="grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <AppIcon icon={icons.feedback.warning} size="xl" tone="inherit" decorative />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground max-w-xs">{description}</p>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {onSecondary && (
          <Button size="sm" onClick={onSecondary} className="gap-1.5">
            <AppIcon icon={icons.actions.reset} size="sm" tone="inherit" decorative />
            {secondaryLabel ?? "Tentar novamente"}
          </Button>
        )}
        {onRetry && (
          <Button
            size="sm"
            variant={onSecondary ? "outline" : "default"}
            onClick={onRetry}
            className="gap-1.5"
          >
            <AppIcon icon={icons.actions.reset} size="sm" tone="inherit" decorative />
            Tentar novamente
          </Button>
        )}
        {onBack && (
          <Button size="sm" variant="outline" onClick={onBack} className="gap-1.5">
            <AppIcon icon={icons.directional.arrowLeft} size="sm" tone="inherit" decorative />
            Voltar
          </Button>
        )}
      </div>
    </div>
  );
}
