// Feedback / support form — integrated into the TopNav.
// Uses design system icons, not emojis.

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { invokeFunction } from "@/lib/supabase";
import { isRealMode } from "@/lib/env";
import { AppIcon } from "@/design-system/icons/AppIcon";
import { icons } from "@/design-system/icons/icon-registry";
import type { LucideIcon } from "lucide-react";

type FeedbackType = "feedback" | "bug" | "question" | "feature_request" | "data_quality";

const FEEDBACK_TYPES: { value: FeedbackType; label: string; icon: LucideIcon }[] = [
  { value: "feedback", label: "Feedback", icon: icons.lead.lightbulb },
  { value: "bug", label: "Reportar problema", icon: icons.feedback.warning },
  { value: "question", label: "Dúvida", icon: icons.feedback.help },
  { value: "feature_request", label: "Sugestão", icon: icons.lead.opportunity },
  { value: "data_quality", label: "Qualidade dos dados", icon: icons.lead.trendingUp },
];

interface FeedbackFormProps {
  trigger?: React.ReactNode;
  currentPage?: string;
  onSuccess?: () => void;
}

export function FeedbackForm({ trigger, currentPage, onSuccess }: FeedbackFormProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("feedback");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) return;

    if (isRealMode) {
      setSubmitting(true);
      try {
        await invokeFunction("submit-feedback", {
          type,
          message: message.trim(),
          currentPage: currentPage ?? window.location.pathname,
          appVersion: import.meta.env.VITE_APP_VERSION as string | undefined,
          browser: navigator.userAgent.slice(0, 200),
          operatingSystem: navigator.platform,
        });
        toast.success(
          type === "bug" ? "Problema reportado. Obrigado!" : "Feedback enviado. Obrigado!",
        );
        setMessage("");
        setOpen(false);
        onSuccess?.();
      } catch {
        toast.error("Erro ao enviar. Tente novamente.");
      } finally {
        setSubmitting(false);
      }
    } else {
      toast.success("Feedback registrado (demo)");
      setMessage("");
      setOpen(false);
      onSuccess?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <AppIcon icon={icons.lead.messageSquare} size="sm" tone="inherit" decorative />
            <span className="ml-1.5">Feedback</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar feedback</DialogTitle>
          <DialogDescription>Sua opinião ajuda a melhorar o Radar Local.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type selector */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Tipo</label>
            <div className="flex flex-wrap gap-1.5">
              {FEEDBACK_TYPES.map((ft) => (
                <Badge
                  key={ft.value}
                  variant={type === ft.value ? "default" : "secondary"}
                  className="cursor-pointer select-none"
                  onClick={() => setType(ft.value)}
                >
                  <AppIcon icon={ft.icon} size="xs" tone="inherit" decorative />
                  <span className="ml-1">{ft.label}</span>
                </Badge>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Mensagem</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                type === "bug"
                  ? "O que aconteceu? O que você esperava?"
                  : "Conte o que você pensa..."
              }
              rows={4}
              maxLength={5000}
              className="resize-none"
            />
            <p className="text-[10px] text-muted-foreground mt-1 text-right">
              {message.length}/5000
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={!message.trim() || submitting}>
              {submitting ? "Enviando..." : "Enviar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
