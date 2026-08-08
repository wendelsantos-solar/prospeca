import { AlertCircle } from "lucide-react";

interface AuthFormAlertProps {
  message?: string | null;
}

export function AuthFormAlert({ message }: AuthFormAlertProps) {
  if (!message) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex items-start gap-2.5 rounded-[10px] border border-destructive/25 bg-destructive/5 px-3.5 py-3 text-body-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.9} aria-hidden />
      <p>{message}</p>
    </div>
  );
}
