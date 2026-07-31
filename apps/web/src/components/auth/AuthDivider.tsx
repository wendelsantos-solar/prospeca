import { cn } from "@/lib/utils";
export function AuthDivider({
  label = "ou continue com e-mail",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="h-px flex-1 bg-border" />
      <span className="shrink-0 text-caption text-muted-foreground">{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
