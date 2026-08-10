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
import {
  useConnectGoogleCalendar,
  useCreateGoogleMeeting,
  useGoogleCalendarStatus,
} from "@/hooks/useGoogleCalendar";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  CalendarDays,
  ExternalLink,
  Video,
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
  attendeeEmail: string;
  durationMinutes: number;
  addToGoogleCalendar: boolean;
}

export function LeadActivitiesTab({ lead, readOnly }: { lead: Lead; readOnly?: boolean }) {
  const addActivityMut = useAddActivityMutation();
  const calendarQuery = useGoogleCalendarStatus();
  const connectCalendarMut = useConnectGoogleCalendar();
  const createMeetingMut = useCreateGoogleMeeting();
  const [act, setAct] = useState<NewActivity>({
    type: "call",
    title: "",
    date: nowDate(),
    time: "",
    note: "",
    priority: "medium",
    attendeeEmail: lead.email ?? "",
    durationMinutes: 30,
    addToGoogleCalendar: false,
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
    setAct({
      type: "call",
      title: "",
      date: nowDate(),
      time: "",
      note: "",
      priority: "medium",
      attendeeEmail: lead.email ?? "",
      durationMinutes: 30,
      addToGoogleCalendar: false,
    });

  const handleSubmit = () => {
    if (!act.title.trim()) return toast.error("Informe um título");
    if (act.type === "meeting" && !act.time) return toast.error("Informe o horário da reunião");
    if (
      act.type === "meeting" &&
      act.attendeeEmail.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(act.attendeeEmail.trim())
    ) {
      return toast.error("Informe um e-mail de convidado válido");
    }
    const scheduledAt = new Date(`${act.date}T${act.time || "09:00"}:00`);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
    addActivityMut.mutate(
      {
        leadId: lead.id,
        input: {
          type: act.type,
          title: act.title.trim(),
          date: act.date,
          time: act.time || undefined,
          scheduledEndAt:
            act.type === "meeting"
              ? new Date(scheduledAt.getTime() + act.durationMinutes * 60_000).toISOString()
              : undefined,
          timezone,
          attendeeEmail:
            act.type === "meeting" && act.attendeeEmail.trim()
              ? act.attendeeEmail.trim()
              : undefined,
          note: act.note.trim() || undefined,
          priority: act.priority,
        },
      },
      {
        onSuccess: async (activity) => {
          resetForm();
          if (act.type === "meeting" && act.addToGoogleCalendar) {
            try {
              const event = await createMeetingMut.mutateAsync(activity.id);
              toast.success(
                event.meeting_url
                  ? "Reunião criada no Google Calendar com link do Meet"
                  : "Evento criado; o Google ainda está preparando o link do Meet",
              );
            } catch (error) {
              toast.error(
                `Atividade salva, mas o Google Calendar falhou: ${
                  error instanceof Error ? error.message : "tente novamente"
                }`,
              );
            }
          } else {
            toast.success("Atividade criada");
          }
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
                onValueChange={(v) =>
                  setAct({
                    ...act,
                    type: v as ActivityType,
                    addToGoogleCalendar:
                      v === "meeting" && calendarQuery.data?.connection?.status === "connected",
                  })
                }
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

          {act.type === "meeting" && (
            <div className="space-y-3 rounded-lg border border-primary/20 bg-primary-soft/40 p-3">
              <div className="flex items-start gap-2">
                <Video className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs font-semibold text-foreground">Dados da reunião</p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    O convite só será enviado ao e-mail informado quando você escolher adicionar ao
                    Google.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">E-mail do convidado (opcional)</Label>
                  <Input
                    type="email"
                    className="h-10 bg-surface text-sm"
                    value={act.attendeeEmail}
                    onChange={(event) => setAct({ ...act, attendeeEmail: event.target.value })}
                    placeholder="contato@empresa.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Duração</Label>
                  <Select
                    value={String(act.durationMinutes)}
                    onValueChange={(value) => setAct({ ...act, durationMinutes: Number(value) })}
                  >
                    <SelectTrigger className="h-10 bg-surface text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SheetSelectContent>
                      <SelectItem value="30">30 minutos</SelectItem>
                      <SelectItem value="45">45 minutos</SelectItem>
                      <SelectItem value="60">1 hora</SelectItem>
                    </SheetSelectContent>
                  </Select>
                </div>
              </div>

              {calendarQuery.data?.connection?.status === "connected" ? (
                <label className="flex cursor-pointer items-start gap-2 rounded-md border bg-surface p-2.5">
                  <Checkbox
                    className="mt-0.5"
                    checked={act.addToGoogleCalendar}
                    onCheckedChange={(checked) =>
                      setAct({ ...act, addToGoogleCalendar: checked === true })
                    }
                  />
                  <span>
                    <span className="block text-xs font-medium">
                      Adicionar ao Google Calendar e gerar Meet
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      Conta conectada: {calendarQuery.data.connection.account_email}
                    </span>
                  </span>
                </label>
              ) : calendarQuery.data?.configured ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  disabled={connectCalendarMut.isPending}
                  onClick={() =>
                    connectCalendarMut.mutate("/app/configuracoes?section=integracoes")
                  }
                >
                  <CalendarDays className="h-4 w-4" />
                  Conectar Google Calendar para gerar Meet
                </Button>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  A integração com Google Calendar ainda não foi configurada neste ambiente.
                </p>
              )}
            </div>
          )}

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
                  {a.calendarEvent && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {a.calendarEvent.meetingUrl && (
                        <a
                          href={a.calendarEvent.meetingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-primary-soft px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary-soft/70"
                        >
                          <Video className="h-3 w-3" /> Abrir Google Meet
                        </a>
                      )}
                      {a.calendarEvent.htmlUrl && (
                        <a
                          href={a.calendarEvent.htmlUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                        >
                          <CalendarDays className="h-3 w-3" /> Ver no Calendar
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {a.calendarEvent.status === "pending" && (
                        <span className="text-[11px] text-muted-foreground">
                          Meet sendo preparado…
                        </span>
                      )}
                    </div>
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
