/**
 * Calendar — shadcn-style date picker component using react-day-picker v9.
 * Fully localized to pt-BR (month names, weekdays).
 *
 * v9 moved selection/today state off the day button and onto the parent
 * `<td>` as data-* attributes (data-selected, data-today, data-outside,
 * data-disabled) — the button itself carries none of them. So the button's
 * classNames use Tailwind's `group-data-*` variant against the `day` cell
 * (marked `group`) instead of dedicated `day_selected`/`day_today` keys,
 * which is what v8-style shadcn calendars relied on and v9 no longer reads.
 */
import * as React from "react";
import { DayPicker } from "react-day-picker";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      locale={ptBR}
      showOutsideDays={showOutsideDays}
      className={cn("w-[280px] p-3", className)}
      classNames={{
        // "relative" here is load-bearing: react-day-picker v9 renders <nav>
        // as a sibling of <Month> (not nested inside month_caption like v8),
        // so the nav's "absolute" only lands top-left/top-right correctly
        // when *this* wrapper is its positioned ancestor.
        months: "relative flex flex-col sm:flex-row gap-4",
        month: "space-y-4",
        month_caption: "flex justify-center pt-1 items-center h-9 select-none",
        caption_label: "text-sm font-medium select-none",
        nav: "z-10 flex items-center justify-between absolute inset-x-1 top-1",
        button_previous: cn(
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 border border-input rounded-md flex items-center justify-center cursor-pointer",
        ),
        button_next: cn(
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 border border-input rounded-md flex items-center justify-center cursor-pointer",
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex justify-between",
        weekday: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
        week: "flex w-full justify-between mt-2",
        day: cn(
          "group relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
          "data-[selected=true]:bg-accent data-[outside=true]:data-[selected=true]:bg-accent/50 rounded-md",
        ),
        day_button: cn(
          "h-8 w-8 p-0 font-normal rounded-md transition-colors hover:bg-accent",
          "group-data-[outside=true]:text-muted-foreground group-data-[outside=true]:opacity-50",
          "group-data-[disabled=true]:text-muted-foreground group-data-[disabled=true]:opacity-50",
          "group-data-[today=true]:bg-accent group-data-[today=true]:text-accent-foreground",
          // "!" forces these to win over the today/outside rules above regardless of
          // Tailwind's generated stylesheet order — a selected+today day must read as selected.
          "group-data-[selected=true]:!bg-primary group-data-[selected=true]:!text-primary-foreground",
          "group-data-[selected=true]:hover:!bg-primary group-data-[selected=true]:focus:!bg-primary",
        ),
        range_start: "rounded-l-md",
        range_end: "rounded-r-md",
        range_middle: "data-[selected=true]:bg-accent data-[selected=true]:rounded-none",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ..._props }) =>
          orientation === "left" ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
