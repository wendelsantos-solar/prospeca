import { useLeadsStore, useMessageStore, useSettingsStore } from "@/stores";
import { useLeadsList } from "@/hooks/useLeadsQuery";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useState, useMemo } from "react";
import { MessageCircle, Copy, X, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { toast } from "sonner";
import { digitsOnly } from "@/lib/format";

export function BulkBar({
  visibleIds,
  onOpenPrepare,
}: {
  visibleIds: string[];
  onOpenPrepare: () => void;
}) {
  const bulkMode = useLeadsStore((s) => s.bulkMode);
  const setBulkMode = useLeadsStore((s) => s.setBulkMode);
  const selected = useLeadsStore((s) => s.selectedIds);
  const clearSelection = useLeadsStore((s) => s.clearSelection);
  const selectVisible = useLeadsStore((s) => s.selectVisible);
  const bulkLimit = useSettingsStore((s) => s.bulkLimit);

  if (!bulkMode) {
    return (
      <div className="flex justify-end p-2">
        <Button
          size="sm"
          onClick={() => setBulkMode(true)}
          className="gap-1.5 h-8 text-xs shadow-elegant"
        >
          <Check className="h-3.5 w-3.5" />
          Iniciar prospecção em massa
        </Button>
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-20 flex items-center gap-2 border-b bg-primary/95 px-4 py-2 text-primary-foreground backdrop-blur">
      <span className="text-sm font-semibold tabular-nums" aria-live="polite">
        {selected.length} de {bulkLimit} selecionados
      </span>
      <div className="ml-auto flex items-center gap-1.5">
        <Button
          size="sm"
          variant="secondary"
          className="h-7 text-xs"
          onClick={() => {
            selectVisible(visibleIds, bulkLimit);
            if (visibleIds.length > bulkLimit)
              toast.info(`Selecionados os ${bulkLimit} primeiros (limite atingido)`);
          }}
        >
          Selecionar visíveis
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-primary-foreground hover:bg-primary/70"
          onClick={clearSelection}
        >
          Limpar
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="h-7 text-xs gap-1"
          onClick={onOpenPrepare}
          disabled={selected.length === 0}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Preparar mensagens
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-primary-foreground hover:bg-primary/70"
          aria-label="Sair"
          onClick={() => setBulkMode(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function fill(template: string, ctx: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => ctx[k] ?? "");
}

export function BulkMessageDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const selected = useLeadsStore((s) => s.selectedIds);
  const { data } = useLeadsList({ quick: [] });
  const allLeads = useMemo(() => data?.items ?? [], [data]);
  const leads = useMemo(
    () => allLeads.filter((l) => selected.includes(l.id)),
    [allLeads, selected],
  );
  const template = useMessageStore((s) => s.template);
  const senderName = useSettingsStore((s) => s.senderName);
  const userName = useSettingsStore((s) => s.userName);
  const signature = useSettingsStore((s) => s.signature);
  const [idx, setIdx] = useState(0);
  const current = leads[idx];
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<Record<string, boolean>>({});

  const getMsg = (leadId: string) => {
    if (messages[leadId] != null) return messages[leadId];
    const l = leads.find((x) => x.id === leadId);
    if (!l) return "";
    const base = fill(template, {
      empresa: l.companyName,
      categoria: l.category.toLowerCase(),
      cidade: l.city,
      bairro: l.neighborhood ?? "",
      meu_nome: senderName || userName,
      responsavel: "",
    });
    return signature ? `${base}\n\n${signature}` : base;
  };

  const currentMsg = useMemo(() => (current ? getMsg(current.id) : ""), [current, template, messages]); // eslint-disable-line

  if (!current) return null;

  const openWA = () => {
    const num = digitsOnly(current.whatsapp ?? current.phone);
    if (!num) return toast.error("Sem WhatsApp/telefone");
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(currentMsg)}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Preparar mensagens ({leads.length})</DialogTitle>
          <DialogDescription>Revise e personalize cada mensagem antes de enviar.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-[220px_1fr] gap-4 min-h-[420px]">
          <div className="border-r pr-3 space-y-1 max-h-[420px] overflow-y-auto">
            {leads.map((l, i) => (
              <button
                key={l.id}
                onClick={() => setIdx(i)}
                className={`w-full text-left rounded-md border p-2 text-xs transition-colors ${i === idx ? "border-primary bg-primary/5" : "border-transparent hover:bg-accent"}`}
              >
                <p className="font-semibold truncate">{l.companyName}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {l.phone ?? "sem telefone"}
                </p>
                {copied[l.id] && (
                  <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-success">
                    <Check className="h-2.5 w-2.5" />
                    Copiado
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{current.companyName}</p>
                <p className="text-xs text-muted-foreground">
                  {current.whatsapp ?? current.phone ?? "sem contato"}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setIdx((i) => Math.max(0, i - 1))}
                  disabled={idx === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setIdx((i) => Math.min(leads.length - 1, i + 1))}
                  disabled={idx === leads.length - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Textarea
              rows={9}
              value={currentMsg}
              onChange={(e) => setMessages((m) => ({ ...m, [current.id]: e.target.value }))}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{currentMsg.length} caracteres</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(currentMsg);
                    setCopied((c) => ({ ...c, [current.id]: true }));
                    toast.success("Copiado");
                  }}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" />
                  Copiar
                </Button>
                <Button size="sm" onClick={openWA}>
                  <MessageCircle className="mr-1 h-3.5 w-3.5" />
                  Abrir WhatsApp
                </Button>
              </div>
            </div>
            <p className="rounded-md border bg-muted/50 p-2 text-[11px] text-muted-foreground">
              Revise cada mensagem antes de enviar. O envio não é automático.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
