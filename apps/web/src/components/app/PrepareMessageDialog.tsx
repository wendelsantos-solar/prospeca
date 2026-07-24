import { useEffect, useState } from "react";
import { Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useMessageStore, useSettingsStore } from "@/stores";
import { buildContactMessage } from "@/lib/message-fill";
import { whatsappDisplay } from "@/lib/whatsapp";
import { useOutbound } from "@/hooks/useOutbound";
import type { Lead } from "@/types";

/**
 * Per-lead message composer — the single-target counterpart of
 * `BulkMessageDialog`. Same template resolution (`buildContactMessage`) and the
 * same outbound gate (`useOutbound`), so opt-out/landline rules still apply.
 */
export function PrepareMessageDialog({
  lead,
  open,
  onOpenChange,
  materialize,
}: {
  lead: Lead;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Set when the target is a discovery result not yet in the funnel. */
  materialize?: { searchId: string; placeId: string };
}) {
  const template = useMessageStore((s) => s.template);
  const senderName = useSettingsStore((s) => s.senderName);
  const userName = useSettingsStore((s) => s.userName);
  const companyName = useSettingsStore((s) => s.companyName);
  const signature = useSettingsStore((s) => s.signature);
  const { openWhatsApp } = useOutbound();
  const [draft, setDraft] = useState("");

  // Reset to the freshly rendered template each time the dialog is opened —
  // editing is scoped to one send, not persisted as the lead's message.
  useEffect(() => {
    if (!open) return;
    setDraft(buildContactMessage(template, lead, { senderName, userName, companyName, signature }));
  }, [open, template, lead, senderName, userName, companyName, signature]);

  const wa = whatsappDisplay(lead.whatsapp, lead.phone);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Preparar mensagem</DialogTitle>
          <DialogDescription>Revise antes de enviar — o envio não é automático.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold">{lead.companyName}</p>
            <p className="text-xs text-muted-foreground">
              {wa ? wa.value : (lead.phone ?? "sem contato")}
            </p>
          </div>
          <Textarea rows={8} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="tabular-nums">{draft.length} caracteres</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(draft);
                  toast.success("Copiado");
                }}
              >
                <Copy className="mr-1 h-3.5 w-3.5" />
                Copiar
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  const sent = await openWhatsApp(lead, { message: draft, materialize });
                  if (sent) onOpenChange(false);
                }}
              >
                <MessageCircle className="mr-1 h-3.5 w-3.5" />
                Abrir WhatsApp
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
