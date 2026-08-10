// Terms of Use + Privacy Policy gate for signup.
// Renders the checkbox that must be accepted before creating an account.

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface TermsGateProps {
  accepted: boolean;
  onAcceptChange: (accepted: boolean) => void;
  disabled?: boolean;
}

export function TermsGate({ accepted, onAcceptChange, disabled }: TermsGateProps) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border bg-surface-2 p-3">
      <Checkbox
        id="terms"
        checked={accepted}
        onCheckedChange={(v) => onAcceptChange(v === true)}
        disabled={disabled}
        className="mt-0.5"
      />
      <Label htmlFor="terms" className="text-[12.5px] leading-relaxed text-muted-foreground">
        Eu li e aceito os{" "}
        <a
          href="/termos"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary underline underline-offset-2 hover:text-primary-hover"
        >
          Termos de Uso
        </a>{" "}
        e a{" "}
        <a
          href="/privacidade"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary underline underline-offset-2 hover:text-primary-hover"
        >
          Política de Privacidade
        </a>
        .
      </Label>
    </div>
  );
}
