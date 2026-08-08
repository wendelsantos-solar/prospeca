/**
 * Date/time pickers triggered by a styled button.
 *
 * Both use our own Popover (+ Calendar for the date) so the dropdown matches
 * the app's design system instead of the browser/OS native picker.
 */
import { useEffect, useRef, useState } from "react";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function DatePickerInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-10 w-full items-center gap-2 rounded-md border px-3 text-left text-sm transition-colors cursor-pointer",
            "bg-surface text-foreground",
            "border-input hover:border-border-strong focus:border-ring focus:ring-1 focus:ring-ring focus:outline-none",
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className={cn("flex-1 tabular-nums", !value && "text-muted-foreground")}>
            {selected ? format(selected, "dd/MM/yyyy") : "dd/mm/aaaa"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="z-[100] w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={ptBR}
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            if (!date) return;
            onChange(format(date, "yyyy-MM-dd"));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

/** Scrolls the selected (or first) item of a time column into view on open —
 * matches native time pickers, which always land on the current value. */
function TimeColumn({
  values,
  selected,
  onSelect,
}: {
  values: string[];
  selected: string | null;
  onSelect: (v: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = listRef.current?.querySelector<HTMLElement>(
      selected ? `[data-value="${selected}"]` : "[data-value]",
    );
    target?.scrollIntoView({ block: "center" });
  }, [selected]);

  return (
    <div
      ref={listRef}
      className="h-56 w-16 touch-pan-y overflow-y-auto overscroll-contain p-1"
      // Radix's Dialog (the lead drawer this popover lives in) locks page
      // scroll by intercepting wheel events; without this, that lock can
      // swallow scroll attempts over this nested list before it moves.
      onWheel={(e) => {
        e.currentTarget.scrollTop += e.deltaY;
      }}
    >
      {values.map((v) => (
        <button
          key={v}
          type="button"
          data-value={v}
          onClick={() => onSelect(v)}
          className={cn(
            "flex h-8 w-full items-center justify-center rounded-md text-sm tabular-nums transition-colors hover:bg-accent cursor-pointer select-none",
            v === selected && "bg-primary text-primary-foreground hover:bg-primary",
          )}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

export function TimePickerInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [hour, minute] = value ? value.split(":") : [null, null];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-10 w-full items-center gap-2 rounded-md border px-3 text-left text-sm transition-colors cursor-pointer",
            "bg-surface text-foreground",
            "border-input hover:border-border-strong focus:border-ring focus:ring-1 focus:ring-ring focus:outline-none",
            className,
          )}
        >
          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className={cn("flex-1 tabular-nums", !value && "text-muted-foreground")}>
            {value || "HH:MM"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="z-[100] w-auto p-0" align="start">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">Horário</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={!value}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
            OK
          </button>
        </div>
        <div className="flex divide-x">
          <TimeColumn
            values={HOURS}
            selected={hour}
            onSelect={(h) => onChange(`${h}:${minute ?? "00"}`)}
          />
          <TimeColumn
            values={MINUTES}
            selected={minute}
            onSelect={(m) => onChange(`${hour ?? "00"}:${m}`)}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
