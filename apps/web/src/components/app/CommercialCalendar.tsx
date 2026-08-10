import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileText,
  MapPin,
  MessageCircle,
  Phone,
  RotateCw,
  Sparkles,
  Users,
  Video,
} from "lucide-react";
import { useCompleteActivityMutation } from "@/hooks/useLeadsQuery";
import {
  buildCommercialCalendarEvents,
  durationMinutes,
  minutesSinceMidnight,
  type CommercialCalendarEvent,
} from "@/lib/commercial-calendar";
import { cn } from "@/lib/utils";
import { useLeadsStore } from "@/stores";
import type { ActivityType, Lead } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";

type CalendarView = "day" | "week" | "month";
type EventFilter = "all" | ActivityType | "cadence";

const START_HOUR = 6;
const END_HOUR = 23;
const HOUR_HEIGHT = 56;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, index) => START_HOUR + index);
const WEEKDAY_LABELS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

const TYPE_META: Record<
  ActivityType | "cadence",
  { label: string; shortLabel: string; icon: typeof Users; className: string }
> = {
  meeting: {
    label: "Reunião",
    shortLabel: "Reuniões",
    icon: Users,
    className: "border-primary/30 bg-primary-soft text-primary",
  },
  call: {
    label: "Ligação",
    shortLabel: "Ligações",
    icon: Phone,
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
  },
  message: {
    label: "Mensagem",
    shortLabel: "Mensagens",
    icon: MessageCircle,
    className:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-300",
  },
  followup: {
    label: "Retorno",
    shortLabel: "Retornos",
    icon: RotateCw,
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  },
  proposal: {
    label: "Proposta",
    shortLabel: "Propostas",
    icon: FileText,
    className:
      "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-300",
  },
  visit: {
    label: "Visita",
    shortLabel: "Visitas",
    icon: MapPin,
    className:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-300",
  },
  other: {
    label: "Outra",
    shortLabel: "Outras",
    icon: Sparkles,
    className: "border-border bg-muted text-muted-foreground",
  },
  cadence: {
    label: "Cadência",
    shortLabel: "Cadências",
    icon: Clock3,
    className: "border-border bg-surface-2 text-muted-foreground",
  },
};

const FILTERS: EventFilter[] = [
  "all",
  "meeting",
  "call",
  "message",
  "followup",
  "proposal",
  "visit",
];

function filterLabel(filter: EventFilter) {
  return filter === "all" ? "Todos" : TYPE_META[filter].shortLabel;
}

function periodLabel(view: CalendarView, anchor: Date) {
  if (view === "day") {
    return format(anchor, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  }
  if (view === "month") {
    const label = format(anchor, "MMMM 'de' yyyy", { locale: ptBR });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  const start = startOfWeek(anchor, { weekStartsOn: 1 });
  const end = endOfWeek(anchor, { weekStartsOn: 1 });
  if (start.getMonth() === end.getMonth()) {
    return `${format(start, "d")}–${format(end, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}`;
  }
  return `${format(start, "d 'de' MMM", { locale: ptBR })} – ${format(end, "d 'de' MMM 'de' yyyy", { locale: ptBR })}`;
}

function visibleRange(view: CalendarView, anchor: Date) {
  if (view === "day") return { start: startOfDay(anchor), end: startOfDay(anchor) };
  if (view === "week") {
    return {
      start: startOfWeek(anchor, { weekStartsOn: 1 }),
      end: endOfWeek(anchor, { weekStartsOn: 1 }),
    };
  }
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  return {
    start: startOfWeek(monthStart, { weekStartsOn: 1 }),
    end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
  };
}

function eventTime(event: CommercialCalendarEvent) {
  if (event.allDay) return "Sem horário";
  return `${format(event.start, "HH:mm")}–${format(event.end, "HH:mm")}`;
}

export function CommercialCalendar({ leads }: { leads: Lead[] }) {
  const [view, setView] = useState<CalendarView>("week");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [filter, setFilter] = useState<EventFilter>("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const [selected, setSelected] = useState<CommercialCalendarEvent | null>(null);

  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) setView("day");
  }, []);

  const allEvents = useMemo(() => buildCommercialCalendarEvents(leads), [leads]);
  const events = useMemo(
    () =>
      allEvents.filter(
        (event) => (showCompleted || !event.done) && (filter === "all" || event.type === filter),
      ),
    [allEvents, filter, showCompleted],
  );

  const range = useMemo(() => visibleRange(view, anchor), [view, anchor]);
  const periodCount = useMemo(
    () =>
      events.filter(
        (event) =>
          event.start >= startOfDay(range.start) && event.start <= endOfDayLocal(range.end),
      ).length,
    [events, range],
  );

  function move(direction: -1 | 1) {
    setAnchor((current) => {
      if (view === "day") return direction < 0 ? subDays(current, 1) : addDays(current, 1);
      if (view === "week") return direction < 0 ? subWeeks(current, 1) : addWeeks(current, 1);
      return direction < 0 ? subMonths(current, 1) : addMonths(current, 1);
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface-2">
      <div className="shrink-0 border-b border-border bg-surface px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAnchor(startOfDay(new Date()))}>
            Hoje
          </Button>
          <div className="flex items-center rounded-md border border-border bg-surface">
            <button
              onClick={() => move(-1)}
              aria-label="Período anterior"
              className="grid h-8 w-8 place-items-center text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => move(1)}
              aria-label="Próximo período"
              className="grid h-8 w-8 place-items-center border-l border-border text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="min-w-[190px] text-[14px] font-semibold text-foreground">
            {periodLabel(view, anchor)}
          </div>
          <span className="text-[11.5px] text-muted-foreground">
            {periodCount} {periodCount === 1 ? "compromisso" : "compromissos"}
          </span>

          <div className="ml-auto flex items-center rounded-md border border-border bg-surface p-0.5">
            {(["day", "week", "month"] as CalendarView[]).map((item) => (
              <button
                key={item}
                onClick={() => setView(item)}
                className={cn(
                  "rounded px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                  view === item
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item === "day" ? "Dia" : item === "week" ? "Semana" : "Mês"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {FILTERS.map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              aria-pressed={filter === item}
              className={cn(
                "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                filter === item
                  ? "border-primary/30 bg-primary-soft text-primary"
                  : "border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground",
              )}
            >
              {filterLabel(item)}
            </button>
          ))}
          <span className="mx-1 h-5 w-px shrink-0 bg-border" />
          <button
            onClick={() => setShowCompleted((current) => !current)}
            aria-pressed={showCompleted}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium",
              showCompleted
                ? "border-primary/30 bg-primary-soft text-primary"
                : "border-border bg-surface text-muted-foreground",
            )}
          >
            <Check className="h-3 w-3" /> Concluídas
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-3">
        {view === "month" ? (
          <MonthCalendar
            anchor={anchor}
            events={events}
            onSelect={setSelected}
            onSelectDay={(day) => {
              setAnchor(day);
              setView("day");
            }}
          />
        ) : (
          <TimeGrid
            days={
              view === "day"
                ? [startOfDay(anchor)]
                : eachDayOfInterval({
                    start: startOfWeek(anchor, { weekStartsOn: 1 }),
                    end: endOfWeek(anchor, { weekStartsOn: 1 }),
                  })
            }
            events={events}
            onSelect={setSelected}
          />
        )}
      </div>

      <EventDetails event={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}

function endOfDayLocal(date: Date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function TimeGrid({
  days,
  events,
  onSelect,
}: {
  days: Date[];
  events: CommercialCalendarEvent[];
  onSelect: (event: CommercialCalendarEvent) => void;
}) {
  const minWidth = days.length === 1 ? 520 : 920;
  const timedHeight = HOURS.length * HOUR_HEIGHT;
  const scrollContainer = useRef<HTMLDivElement>(null);
  const firstDayTime = days[0]?.getTime();
  const includesToday = days.some((day) => isToday(day));

  useEffect(() => {
    const current = new Date();
    const targetHour = includesToday ? Math.max(START_HOUR, current.getHours() - 2) : 8;
    if (scrollContainer.current) {
      scrollContainer.current.scrollTop = Math.max(0, (targetHour - START_HOUR) * HOUR_HEIGHT);
    }
  }, [days.length, firstDayTime, includesToday]);

  return (
    <div
      ref={scrollContainer}
      className="h-full overflow-auto rounded-xl border border-border bg-surface shadow-card"
    >
      <div style={{ minWidth }}>
        <div
          className="sticky top-0 z-30 grid border-b border-border bg-surface/95 backdrop-blur"
          style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))` }}
        >
          <div className="border-r border-border" />
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className={cn(
                "border-r border-border px-2 py-2 text-center last:border-r-0",
                isToday(day) && "bg-primary-soft/70",
              )}
            >
              <div className="text-[10.5px] font-semibold uppercase text-muted-foreground">
                {format(day, "EEE", { locale: ptBR }).replace(".", "")}
              </div>
              <div
                className={cn(
                  "mx-auto mt-0.5 grid h-7 w-7 place-items-center rounded-full text-[13px] font-semibold",
                  isToday(day) && "bg-primary text-primary-foreground",
                )}
              >
                {format(day, "d")}
              </div>
            </div>
          ))}
        </div>

        <div
          className="grid border-b border-border bg-surface-2/70"
          style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))` }}
        >
          <div className="border-r border-border px-2 py-2 text-right text-[9.5px] font-medium uppercase text-muted-foreground">
            Dia
          </div>
          {days.map((day) => {
            const dayEvents = events.filter((event) => event.allDay && isSameDay(event.start, day));
            return (
              <div
                key={day.toISOString()}
                className="min-h-10 space-y-1 border-r border-border p-1 last:border-r-0"
              >
                {dayEvents.map((event) => (
                  <CalendarEventPill key={event.id} event={event} onClick={() => onSelect(event)} />
                ))}
              </div>
            );
          })}
        </div>

        <div className="flex" style={{ height: timedHeight }}>
          <div className="relative w-16 shrink-0 border-r border-border bg-surface">
            {HOURS.map((hour, index) => (
              <div
                key={hour}
                className="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground"
                style={{ top: index * HOUR_HEIGHT }}
              >
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          <div
            className="grid min-w-0 flex-1"
            style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
          >
            {days.map((day) => (
              <DayColumn
                key={day.toISOString()}
                day={day}
                height={timedHeight}
                events={events.filter((event) => !event.allDay && isSameDay(event.start, day))}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DayColumn({
  day,
  height,
  events,
  onSelect,
}: {
  day: Date;
  height: number;
  events: CommercialCalendarEvent[];
  onSelect: (event: CommercialCalendarEvent) => void;
}) {
  const now = new Date();
  const currentMinutes = minutesSinceMidnight(now);
  const showNow =
    isToday(day) && currentMinutes >= START_HOUR * 60 && currentMinutes < END_HOUR * 60;
  const laidOut = useMemo(() => layoutEvents(events), [events]);

  return (
    <div
      className={cn(
        "relative border-r border-border last:border-r-0",
        isToday(day) && "bg-primary/[0.018]",
      )}
      style={{ height }}
    >
      {HOURS.map((hour, index) => (
        <div
          key={hour}
          className="absolute inset-x-0 border-t border-border/70"
          style={{ top: index * HOUR_HEIGHT }}
        />
      ))}
      {showNow && (
        <div
          className="absolute inset-x-0 z-20 border-t-2 border-destructive"
          style={{ top: ((currentMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT }}
        >
          <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-destructive" />
        </div>
      )}
      {laidOut.map(({ event, lane, laneCount }) => {
        const top = Math.max(
          0,
          ((minutesSinceMidnight(event.start) - START_HOUR * 60) / 60) * HOUR_HEIGHT,
        );
        const eventHeight = Math.max(34, (durationMinutes(event) / 60) * HOUR_HEIGHT);
        const width = 100 / laneCount;
        return (
          <CalendarEventBlock
            key={event.id}
            event={event}
            onClick={() => onSelect(event)}
            style={{
              top: top + 2,
              height: Math.min(eventHeight - 3, height - top - 2),
              left: `calc(${lane * width}% + 3px)`,
              width: `calc(${width}% - 6px)`,
            }}
          />
        );
      })}
    </div>
  );
}

function layoutEvents(events: CommercialCalendarEvent[]) {
  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
  const laneEndTimes: number[] = [];
  const placed = sorted.map((event) => {
    let lane = laneEndTimes.findIndex((end) => end <= event.start.getTime());
    if (lane === -1) lane = laneEndTimes.length;
    laneEndTimes[lane] = event.end.getTime();
    return { event, lane, laneCount: 1 };
  });
  const laneCount = Math.max(1, laneEndTimes.length);
  return placed.map((item) => ({ ...item, laneCount }));
}

function CalendarEventBlock({
  event,
  onClick,
  style,
}: {
  event: CommercialCalendarEvent;
  onClick: () => void;
  style: React.CSSProperties;
}) {
  const meta = TYPE_META[event.type];
  const Icon = meta.icon;
  return (
    <button
      onClick={onClick}
      style={style}
      className={cn(
        "absolute z-10 overflow-hidden rounded-md border px-1.5 py-1 text-left shadow-sm transition hover:z-20 hover:brightness-[0.98] focus-visible:z-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        meta.className,
        event.done && "opacity-55",
      )}
      title={`${event.title} · ${eventTime(event)}`}
    >
      <div className="flex items-center gap-1 text-[9.5px] font-semibold tabular-nums opacity-80">
        <Icon className="h-3 w-3 shrink-0" /> {format(event.start, "HH:mm")}
        {event.activity?.calendarEvent?.meetingUrl && <Video className="ml-auto h-3 w-3" />}
      </div>
      <div
        className={cn("mt-0.5 truncate text-[10.5px] font-semibold", event.done && "line-through")}
      >
        {event.title}
      </div>
      <div className="truncate text-[9.5px] opacity-80">{event.lead.companyName}</div>
    </button>
  );
}

function CalendarEventPill({
  event,
  onClick,
}: {
  event: CommercialCalendarEvent;
  onClick: () => void;
}) {
  const meta = TYPE_META[event.type];
  return (
    <button
      onClick={onClick}
      className={cn(
        "block w-full truncate rounded border px-1.5 py-1 text-left text-[9.5px] font-medium",
        meta.className,
        event.done && "line-through opacity-55",
      )}
      title={event.title}
    >
      {event.title}
    </button>
  );
}

function MonthCalendar({
  anchor,
  events,
  onSelect,
  onSelectDay,
}: {
  anchor: Date;
  events: CommercialCalendarEvent[];
  onSelect: (event: CommercialCalendarEvent) => void;
  onSelectDay: (day: Date) => void;
}) {
  const { start, end } = visibleRange("month", anchor);
  const days = eachDayOfInterval({ start, end });

  return (
    <div className="h-full overflow-auto rounded-xl border border-border bg-surface shadow-card">
      <div className="grid min-w-[760px] grid-cols-7 border-b border-border bg-surface-2">
        {WEEKDAY_LABELS.map((day) => (
          <div
            key={day}
            className="border-r border-border px-2 py-2 text-center text-[10.5px] font-semibold uppercase text-muted-foreground last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid min-w-[760px] grid-cols-7">
        {days.map((day) => {
          const dayEvents = events.filter((event) => isSameDay(event.start, day));
          const visible = dayEvents.slice(0, 3);
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "min-h-[116px] border-b border-r border-border p-1.5 [&:nth-child(7n)]:border-r-0",
                !isSameMonth(day, anchor) && "bg-surface-2/70",
                isToday(day) && "bg-primary-soft/40",
              )}
            >
              <button
                onClick={() => onSelectDay(day)}
                className={cn(
                  "mb-1 grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground",
                  isToday(day) && "bg-primary text-primary-foreground hover:bg-primary",
                  !isSameMonth(day, anchor) && "opacity-50",
                )}
                aria-label={`Abrir ${format(day, "dd/MM/yyyy")}`}
              >
                {format(day, "d")}
              </button>
              <div className="space-y-1">
                {visible.map((event) => (
                  <CalendarEventPill key={event.id} event={event} onClick={() => onSelect(event)} />
                ))}
                {dayEvents.length > visible.length && (
                  <button
                    onClick={() => onSelectDay(day)}
                    className="px-1 text-[9.5px] font-medium text-muted-foreground hover:text-primary"
                  >
                    +{dayEvents.length - visible.length} compromissos
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventDetails({
  event,
  onOpenChange,
}: {
  event: CommercialCalendarEvent | null;
  onOpenChange: (open: boolean) => void;
}) {
  const completeMutation = useCompleteActivityMutation();
  const setDetails = useLeadsStore((state) => state.setDetails);
  if (!event) return null;

  const meta = TYPE_META[event.type];
  const Icon = meta.icon;

  function toggleDone() {
    if (!event?.activity) return;
    completeMutation.mutate({
      leadId: event.lead.id,
      activityId: event.activity.id,
      done: !event.done,
    });
    toast.success(event.done ? "Atividade reaberta" : "Atividade concluída");
    onOpenChange(false);
  }

  return (
    <Sheet open={Boolean(event)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="pr-6">
          <div
            className={cn(
              "mb-2 grid h-10 w-10 place-items-center rounded-lg border",
              meta.className,
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <SheetTitle>{event.title}</SheetTitle>
          <SheetDescription>{meta.label} comercial</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <section className="rounded-xl border border-border bg-surface-2 p-4">
            <button
              onClick={() => {
                setDetails(event.lead.id);
                onOpenChange(false);
              }}
              className="text-left text-[14px] font-semibold text-foreground hover:text-primary"
            >
              {event.lead.companyName}
            </button>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">
              {event.lead.category} · {event.lead.city}
            </p>
            <div className="mt-3 flex items-start gap-2 text-[12px] text-foreground">
              <CalendarDays className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <div className="font-medium">
                  {format(event.start, "EEEE, d 'de' MMMM", { locale: ptBR })}
                </div>
                <div className="text-muted-foreground">{eventTime(event)}</div>
              </div>
            </div>
          </section>

          {event.activity?.note && (
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Observação
              </h3>
              <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground">
                {event.activity.note}
              </p>
            </section>
          )}

          <div className="grid gap-2">
            {event.activity?.calendarEvent?.meetingUrl && !event.done && (
              <Button asChild>
                <a href={event.activity.calendarEvent.meetingUrl} target="_blank" rel="noreferrer">
                  <Video /> Entrar no Meet
                </a>
              </Button>
            )}
            {event.activity?.calendarEvent?.htmlUrl && (
              <Button variant="outline" asChild>
                <a href={event.activity.calendarEvent.htmlUrl} target="_blank" rel="noreferrer">
                  <ExternalLink /> Abrir no Google Calendar
                </a>
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setDetails(event.lead.id);
                onOpenChange(false);
              }}
            >
              Ver oportunidade
            </Button>
            {event.activity && (
              <Button variant={event.done ? "outline" : "default"} onClick={toggleDone}>
                <Check /> {event.done ? "Reabrir atividade" : "Marcar como concluída"}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
