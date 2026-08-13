import { useLeadsStore, useMessageStore, useSettingsStore } from "@/stores";
import { useLeadsList, useDiscoveryResults } from "@/hooks/useLeadsQuery";
import { useOutbound } from "@/hooks/useOutbound";

interface BulkTarget {
  id: string;
  name: string;
  category: string;
  city: string;
  neighborhood: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  hasWebsite: boolean;
  rating: number | null;
  reviewCount: number | null;
  kind: "discovery" | "lead";
  inFunnel: boolean;
}
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
import { MessageCircle, Copy, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { toast } from "sonner";
import { buildContactMessage } from "@/lib/message-fill";

export function BulkMessageDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const selected = useLeadsStore((s) => s.selectedIds);
  const currentSearch = useLeadsStore((s) => s.currentSearch);
  const { data: leadPage } = useLeadsList({ quick: [] });
  const { data: discovery } = useDiscoveryResults(currentSearch?.id);
  const { openWhatsApp } = useOutbound();

  // Selection can hold discovery place ids (prospecting from the sidebar/map) or
  // lead ids (kanban). Resolve each against both so the dialog works for either.
  const targets = useMemo<BulkTarget[]>(() => {
    const byPlace = new Map((discovery ?? []).map((r) => [r.placeId, r]));
    const byLead = new Map((leadPage?.items ?? []).map((l) => [l.id, l]));
    return selected
      .map((id): BulkTarget | null => {
        const r = byPlace.get(id);
        if (r) {
          return {
            id: r.placeId,
            name: r.name,
            category: r.category ?? "",
            city: "",
            neighborhood: "",
            phone: r.phone,
            whatsapp: r.whatsapp,
            email: r.email,
            hasWebsite: r.hasWebsite,
            rating: r.rating,
            reviewCount: r.reviewCount,
            kind: "discovery",
            inFunnel: r.importedLeadId != null,
          };
        }
        const l = byLead.get(id);
        if (l) {
          return {
            id: l.id,
            name: l.companyName,
            category: l.category,
            city: l.city,
            neighborhood: l.neighborhood ?? "",
            phone: l.phone ?? null,
            whatsapp: l.whatsapp ?? null,
            email: l.email ?? null,
            hasWebsite: l.hasWebsite,
            rating: l.rating ?? null,
            reviewCount: l.reviewCount ?? null,
            kind: "lead",
            inFunnel: true,
          };
        }
        return null;
      })
      .filter((t): t is BulkTarget => t !== null);
  }, [selected, discovery, leadPage]);

  const template = useMessageStore((s) => s.template);
  const senderName = useSettingsStore((s) => s.senderName);
  const userName = useSettingsStore((s) => s.userName);
  const signature = useSettingsStore((s) => s.signature);
  const [idx, setIdx] = useState(0);
  const current = targets[idx];
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<Record<string, boolean>>({});

  const getMsg = (id: string) => {
    if (messages[id] != null) return messages[id];
    const t = targets.find((x) => x.id === id);
    if (!t) return "";
    return buildContactMessage(
      template,
      {
        companyName: t.name,
        category: t.category,
        city: t.city,
        neighborhood: t.neighborhood,
        phone: t.phone,
        hasWebsite: t.hasWebsite,
        rating: t.rating,
        reviewCount: t.reviewCount,
      },
      { senderName, userName, signature },
    );
  };

  const currentMsg = useMemo(
    () => (current ? getMsg(current.id) : ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getMsg is defined inline; memo keyed on its real inputs
    [current, template, messages],
  );

  if (!current) return null;

  const openWA = () => {
    void openWhatsApp(current, {
      message: currentMsg,
      // Contatar uma empresa descoberta materializa o lead como 'contacted'.
      materialize:
        current.kind === "discovery" && !current.inFunnel && currentSearch
          ? { searchId: currentSearch.id, placeId: current.id }
          : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Preparar mensagens ({targets.length})</DialogTitle>
          <DialogDescription>Revise e personalize cada mensagem antes de enviar.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-[220px_1fr] gap-4 min-h-[420px]">
          <div className="border-r pr-3 space-y-1 max-h-[420px] overflow-y-auto">
            {targets.map((l, i) => (
              <button
                key={l.id}
                onClick={() => setIdx(i)}
                className={`w-full text-left rounded-md border p-2 text-xs transition-colors ${i === idx ? "border-primary bg-primary/5" : "border-transparent hover:bg-accent"}`}
              >
                <p className="font-semibold truncate">{l.name}</p>
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
                <p className="font-semibold">{current.name}</p>
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
                  onClick={() => setIdx((i) => Math.min(targets.length - 1, i + 1))}
                  disabled={idx === targets.length - 1}
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
