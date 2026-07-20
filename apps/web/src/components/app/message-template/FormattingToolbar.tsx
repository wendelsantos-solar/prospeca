import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Smile,
  Braces,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EMOJI_OPTIONS, FORMAT_BUTTONS, LEAD_VAR_DEFS, SENDER_VAR_DEFS } from "./constants";

const ICONS = { bold: Bold, italic: Italic, strike: Strikethrough, code: Code };

interface FormattingToolbarProps {
  onFormat: (before: string, after: string) => void;
  onList: (marker: (lineIndex: number) => string) => void;
  onInsertText: (text: string) => void;
  onInsertVariable: (key: string) => void;
}

export function FormattingToolbar({
  onFormat,
  onList,
  onInsertText,
  onInsertVariable,
}: FormattingToolbarProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-t-md border border-b-0 bg-muted/30 px-1.5 py-1">
      {FORMAT_BUTTONS.map(({ id, label, before, after, shortcut }) => {
        const Icon = ICONS[id];
        return (
          <Tooltip key={id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={label}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onFormat(before, after)}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {label} · <span className="font-mono">{shortcut}</span>
            </TooltipContent>
          </Tooltip>
        );
      })}
      <div className="mx-0.5 h-4 w-px bg-border" />
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Lista"
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onList(() => "- ")}
          >
            <List className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Lista</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Lista numerada"
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onList((i) => `${i + 1}. `)}
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Lista numerada</TooltipContent>
      </Tooltip>
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Emoji"
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Smile className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Emoji</TooltipContent>
        </Tooltip>
        <PopoverContent className="w-auto p-1.5" align="start">
          <div className="flex gap-1">
            {EMOJI_OPTIONS.map((e) => (
              <button
                key={e}
                type="button"
                className="rounded p-1 text-base hover:bg-accent"
                onClick={() => onInsertText(e)}
              >
                {e}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="ml-auto flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Braces className="h-3 w-3" />
                Inserir variável
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Inserir variável no cursor</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
          <DropdownMenuLabel className="text-[11px]">Dados do lead</DropdownMenuLabel>
          {LEAD_VAR_DEFS.map(({ key, label }) => (
            <DropdownMenuItem key={key} onClick={() => onInsertVariable(key)}>
              <span className="font-mono text-xs">{`{{${key}}}`}</span>
              <span className="ml-2 text-[11px] text-muted-foreground">{label}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[11px]">Dados do remetente</DropdownMenuLabel>
          {SENDER_VAR_DEFS.map(({ key, label }) => (
            <DropdownMenuItem key={key} onClick={() => onInsertVariable(key)}>
              <span className="font-mono text-xs">{`{{${key}}}`}</span>
              <span className="ml-2 text-[11px] text-muted-foreground">{label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
