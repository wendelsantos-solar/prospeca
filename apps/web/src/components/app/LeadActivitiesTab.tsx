/**
 * Activities tab for LeadDetailsDrawer — lazy-loaded chunk (~4 KB).
 * Extracted so the drawer opens immediately on the default "Visão geral" tab
 * and only downloads this form + list when the user clicks "Atividades".
 *
 * Includes a SheetSelectContent wrapper that elevates the select popover above
 * the Radix Dialog overlay (both default to z-50), fixing clicks that miss and
 * focus that gets trapped.
 */
import { useState } from "react";
import type { Lead, ActivityType } from "@/types";
import { useAddActivityMutation } from "@/hooks/useLeadsQuery";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePickerInput, TimePickerInput } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PlusCircle,
  Phone,
  MessageCircle,
  Users,
  RotateCw,
  FileText,
  MapPin,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

// ── Fix: elevate Select popover above Sheet overlay ──────────────────

/** Both Radix Dialog/Sheet and shadcn Select default to z-50. Inside a Sheet
 * this makes the select popup render behind or at the same level as the
 * overlay — clicks miss, focus gets trapped. z-[100] beats both. */
function SheetSelectContent({
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectContent>) {
  return (
    <SelectContent className="z-[100]" {...props}>
      {children}
    </SelectContent>
  );
}

// ── Type labels & icons (mirrors ActivityItem.tsx) ────────────────────

const TYPE_LABELS: Record<ActivityType, string> = {
  call: "Ligação",
  message: "Mensagem",
  meeting: "Reunião",
  followup: "Retorno",
  proposal: "Proposta",
  visit: "Visita",
  other: "Outra",
};

const TYPE_ICONS: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  call: Phone,
  message: MessageCircle,
  meeting: Users,
  followup: RotateCw,
  proposal: FileText,
  visit: MapPin,
  other: Sparkles,
};

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  low: "bg-muted text-muted-foreground border-border",
};

const PRIORITY_LABELS: Record<string, string> = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

// ── Component ─────────────────────────────────────────────────────────

const nowDate = () => new Date().toISOString().slice(0, 10);

interface NewActivity {
  type: ActivityType;
  title: string;
  date: string;
  time: string;
  note: string;
  priority: "low" | "medium" | "high";
}

export function LeadActivitiesTab({ lead, readOnly }: { lead: Lead; readOnly?: boolean }) {
  const addActivityMut = useAddActivityMutation();
  const [act, setAct] = useState<NewActivity>({
    type: "call",
    title: "",
    date: nowDate(),
    time: "",
    note: "",
    priority: "medium",
  });

  if (readOnly) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center">
        <PlusCircle className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Adicione ao funil para gerenciar atividades.
        </p>
      </div>
    );
  }

  const resetForm = () =>
    setAct({ type: "call", title: "", date: nowDate(), time: "", note: "", priority: "medium" });

  const handleSubmit = () => {
    if (!act.title.trim()) return toast.error("Informe um título");
    addActivityMut.mutate(
      {
        leadId: lead.id,
        input: {
          type: act.type,
          title: act.title.trim(),
          date: act.date,
          time: act.time || undefined,
          note: act.note.trim() || undefined,
          priority: act.priority,
        },
      },
      {
        onSuccess: () => {
          toast.success("Atividade criada");
          resetForm();
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      {/* ── New activity form ── */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Nova atividade
        </p>

        <div className="space-y-3">
          {/* Row 1: Type + Date + Time */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select
                value={act.type}
                onValueChange={(v) => setAct({ ...act, type: v as ActivityType })}
              >
                <SelectTrigger className="h-10 bg-surface text-sm cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SheetSelectContent>
                  {(
                    [
                      "call",
                      "message",
                      "meeting",
                      "followup",
                      "proposal",
                      "visit",
                      "other",
                    ] as ActivityType[]
                  ).map((v) => {
                    const Icon = TYPE_ICONS[v];
                    return (
                      <SelectItem key={v} value={v}>
                        <span className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          {TYPE_LABELS[v]}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SheetSelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data</Label>
              <DatePickerInput value={act.date} onChange={(v) => setAct({ ...act, date: v })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Horário</Label>
              <TimePickerInput value={act.time} onChange={(v) => setAct({ ...act, time: v })} />
            </div>
          </div>

          {/* Row 2: Title */}
          <div className="space-y-1.5">
            <Label className="text-xs">Título</Label>
            <Input
              className="h-10 bg-surface text-sm"
              value={act.title}
              onChange={(e) => setAct({ ...act, title: e.target.value })}
              placeholder="Ex.: Ligação de follow-up"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
            />
          </div>

          {/* Row 3: Priority */}
          <div className="space-y-1.5">
            <Label className="text-xs">Prioridade</Label>
            <div className="flex gap-2">
              {(["low", "medium", "high"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAct({ ...act, priority: p })}
                  className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                    act.priority === p
                      ? PRIORITY_STYLES[p] + " ring-1 ring-inset"
                      : "border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground"
                  }`}
                >
                  {PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Row 4: Note */}
          <div className="space-y-1.5">
            <Label className="text-xs">Observação (opcional)</Label>
            <Textarea
              className="bg-surface text-sm resize-none"
              rows={2}
              value={act.note}
              onChange={(e) => setAct({ ...act, note: e.target.value })}
              placeholder="Detalhes da atividade..."
            />
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={addActivityMut.isPending}
            className="w-full gap-1.5 cursor-pointer"
          >
            {addActivityMut.isPending ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Criando...
              </>
            ) : (
              <>
                <PlusCircle className="h-4 w-4" />
                Criar atividade
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ── Existing activities list ── */}
      <div className="space-y-2">
        {lead.activities.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nenhuma atividade agendada. Crie uma acima.
          </p>
        ) : (
          lead.activities.map((a) => {
            const Icon = TYPE_ICONS[a.type] ?? Sparkles;
            return (
              <div
                key={a.id}
                className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                  a.done
                    ? "border-border bg-muted/20"
                    : "border-border bg-surface hover:border-border-strong"
                }`}
              >
                <div
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                    a.done ? "bg-muted text-muted-foreground" : "bg-primary-soft text-primary"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-[13px] font-semibold ${
                      a.done ? "text-muted-foreground line-through" : "text-foreground"
                    }`}
                  >
                    {a.title}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-muted-foreground">
                    <span>{TYPE_LABELS[a.type]}</span>
                    {a.priority && (
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
                          PRIORITY_STYLES[a.priority]
                        }`}
                      >
                        {PRIORITY_LABELS[a.priority]}
                      </span>
                    )}
                    <span>·</span>
                    <span>
                      {formatDate(a.date)}
                      {a.time ? ` às ${a.time}` : ""}
                    </span>
                  </div>
                  {a.note && (
                    <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                      {a.note}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
