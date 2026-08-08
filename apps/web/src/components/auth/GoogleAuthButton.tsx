import { useState, useCallback } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { googleAuthEnabled, googleAuthVisible } from "@/hooks/useAuth";
import { track } from "@/lib/analytics";
import { GoogleIcon } from "@/components/marketing/brand-icons";

interface GoogleAuthButtonProps {
  label?: string;
  className?: string;
  onStart?: () => void;
  /** Called when the redirect never happens (e.g. misconfigured provider,
   * network error) — use this to undo whatever onStart() disabled. */
  onError?: () => void;
}

export function GoogleAuthButton({
  label = "Continuar com Google",
  className,
  onStart,
  onError,
}: GoogleAuthButtonProps) {
  const [state, setState] = useState<"idle" | "loading">("idle");
  const visible = googleAuthVisible();
  const enabled = googleAuthEnabled();

  const handleClick = useCallback(async () => {
    if (state !== "idle" || !enabled) return;
    setState("loading");
    track("google_auth_started");
    try {
      const { signInWithGoogle } = await import("@/hooks/useAuth");
      onStart?.();
      await signInWithGoogle();
    } catch (err) {
      track("google_auth_failed", {
        error_category: err instanceof Error ? "provider" : "unknown",
      });
      setState("idle");
      onError?.();
      toast.error(err instanceof Error ? err.message : "Falha ao conectar com o Google.");
    }
  }, [state, enabled, onStart, onError]);

  if (!visible) return null;
  const loading = state === "loading";
  const disabled = !enabled || loading;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className={cn(
          "flex h-11 w-full items-center justify-center gap-2.5 rounded-[10px] border border-border bg-surface text-body-sm font-medium text-foreground transition-all hover:border-border-strong hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      >
        {loading ? (
          <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" strokeWidth={2} />
        ) : (
          <GoogleIcon className="h-[18px] w-[18px]" />
        )}
        <span>{loading ? "Conectando ao Google…" : label}</span>
      </button>
      {!enabled && import.meta.env.DEV && (
        <p className="mt-1.5 text-center text-caption text-warning-foreground/70">
          Google Auth não configurado neste ambiente
        </p>
      )}
    </div>
  );
}
