import { useState, useCallback, type InputHTMLAttributes } from "react";
import { Eye, EyeOff, AlertTriangle, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { passwordPolicy } from "@/lib/password-policy";

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  showRequirements?: boolean;
  value?: string;
  wrapperClassName?: string;
  error?: string;
}

function getStrength(pw: string): { label: string; color: string } | null {
  const met = passwordPolicy(pw).filter((r) => r.met).length;
  if (pw.length === 0) return null;
  if (met <= 1) return { label: "Fraca", color: "text-destructive" };
  if (met <= 2) return { label: "Média", color: "text-warning-foreground" };
  if (met <= 3) return { label: "Boa", color: "text-info" };
  return { label: "Excelente", color: "text-success" };
}

export function PasswordInput({
  showRequirements = false,
  value,
  wrapperClassName,
  error,
  className,
  disabled,
  id,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const [caps, setCaps] = useState(false);
  const reqs = showRequirements ? passwordPolicy(value ?? "") : [];
  const strength = showRequirements ? getStrength(value ?? "") : null;

  return (
    <div className={cn("space-y-1.5", wrapperClassName)}>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          className={cn(
            "flex h-10 w-full rounded-[10px] border border-input bg-surface px-3 pr-10 text-body text-foreground placeholder:text-muted-foreground/60 transition-colors hover:border-border-strong focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-destructive focus:border-destructive focus:ring-destructive/20",
            className,
          )}
          autoComplete={showRequirements ? "new-password" : "current-password"}
          spellCheck={false}
          {...(value !== undefined ? { value } : {})}
          disabled={disabled}
          onKeyUp={(e) => setCaps(e.getModifierState("CapsLock"))}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          disabled={disabled}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground disabled:opacity-50"
          tabIndex={-1}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        >
          {visible ? (
            <EyeOff className="h-4 w-4" strokeWidth={1.75} />
          ) : (
            <Eye className="h-4 w-4" strokeWidth={1.75} />
          )}
        </button>
      </div>
      {caps && (
        <p className="flex items-center gap-1.5 text-caption text-warning-foreground">
          <AlertTriangle className="h-3 w-3" strokeWidth={1.75} />
          Caps Lock ativado
        </p>
      )}
      {error && <p className="text-caption text-destructive">{error}</p>}
      {showRequirements && reqs.length > 0 && (
        <div className="pt-1">
          {strength && (
            <div className="mb-2">
              <div className="flex items-center gap-2">
                <div className="flex flex-1 gap-1">
                  {[0, 1, 2, 3].map((i) => {
                    const m = reqs.filter((r) => r.met).length;
                    return (
                      <div
                        key={i}
                        className={cn(
                          "h-1 flex-1 rounded-full",
                          i < m
                            ? m <= 2
                              ? "bg-destructive"
                              : m === 3
                                ? "bg-warning"
                                : "bg-success"
                            : "bg-border",
                        )}
                      />
                    );
                  })}
                </div>
                <span className={cn("text-caption font-medium", strength.color)}>
                  {strength.label}
                </span>
              </div>
            </div>
          )}
          <ul className="space-y-0.5">
            {reqs.map((r) => (
              <li
                key={r.label}
                className={cn(
                  "flex items-center gap-1.5 text-caption",
                  r.met ? "text-success" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid h-3.5 w-3.5 place-items-center rounded-full border text-[10px]",
                    r.met
                      ? "border-success/30 bg-success-soft text-success"
                      : "border-border bg-transparent text-transparent",
                  )}
                >
                  <Check className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden />
                </span>
                {r.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
