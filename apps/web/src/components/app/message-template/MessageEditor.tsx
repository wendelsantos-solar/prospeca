import type { RefObject } from "react";
import { Info, CheckCircle2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { MessageTemplateType } from "@/stores";
import { TEMPLATE_TYPES } from "./constants";
import { FormattingToolbar } from "./FormattingToolbar";
import { VariableSection } from "./VariableSection";

interface MessageEditorProps {
  nameDraft: string;
  onNameChange: (v: string) => void;
  typeDraft: string;
  onTypeChange: (v: MessageTemplateType) => void;
  draft: string;
  onDraftChange: (v: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onFormat: (before: string, after: string) => void;
  onList: (marker: (lineIndex: number) => string) => void;
  onInsertText: (text: string) => void;
  onInsertVariable: (key: string) => void;
  onSaveShortcut: () => void;
  wordCount: number;
  messageCount: number;
  sizeHint: { label: string; tone: string; bg: string; dot: string };
}

export function MessageEditor({
  nameDraft,
  onNameChange,
  typeDraft,
  onTypeChange,
  draft,
  onDraftChange,
  textareaRef,
  onFormat,
  onList,
  onInsertText,
  onInsertVariable,
  onSaveShortcut,
  wordCount,
  messageCount,
  sizeHint,
}: MessageEditorProps) {
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="tpl-name" className="text-xs">
            Nome do modelo
          </Label>
          <input
            id="tpl-name"
            className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={nameDraft}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Primeira abordagem — Clínicas"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Use um nome que facilite identificar quando este modelo será utilizado.
          </p>
        </div>
        <div>
          <Label className="text-xs">Tipo do modelo</Label>
          <Select value={typeDraft} onValueChange={(v) => onTypeChange(v as MessageTemplateType)}>
            <SelectTrigger className="mt-1 h-[36px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEMPLATE_TYPES.map(({ value, label, icon: Icon }) => (
                <SelectItem key={value} value={value}>
                  <span className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-1">
          <Label className="text-xs">Mensagem</Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Info className="h-3 w-3 text-muted-foreground" />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              Use {"{{variável}}"} pra personalizar automaticamente por lead
            </TooltipContent>
          </Tooltip>
        </div>
        <FormattingToolbar
          onFormat={onFormat}
          onList={onList}
          onInsertText={onInsertText}
          onInsertVariable={onInsertVariable}
        />
        <Textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
              e.preventDefault();
              onSaveShortcut();
            }
          }}
          placeholder="Digite sua mensagem..."
          className="min-h-[340px] resize-none rounded-t-none focus-visible:ring-emerald-500"
        />
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>{draft.length} caracteres</span>
            <span aria-hidden>•</span>
            <span>{wordCount} palavras</span>
            <span aria-hidden>•</span>
            <span>
              ~{messageCount} mensagem{messageCount > 1 ? "s" : ""}
            </span>
          </div>
          <span
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${sizeHint.tone} ${sizeHint.bg}`}
          >
            <CheckCircle2 className="h-3 w-3" />
            {sizeHint.label}
          </span>
        </div>
      </div>

      <VariableSection onInsert={onInsertVariable} />
    </div>
  );
}
