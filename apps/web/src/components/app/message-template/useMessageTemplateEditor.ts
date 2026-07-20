import { useEffect, useMemo, useRef, useState } from "react";
import { getSizeHint } from "./constants";

export interface TemplateDraftValues {
  template: string;
  templateName: string;
  templateType: string;
}

export function useMessageTemplateEditor(initial: TemplateDraftValues) {
  const [draft, setDraft] = useState(initial.template);
  const [nameDraft, setNameDraft] = useState(initial.templateName);
  const [typeDraft, setTypeDraft] = useState(initial.templateType);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize: grow past the CSS min-height as content grows, shrink back down.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  const resetDrafts = (values: TemplateDraftValues) => {
    setDraft(values.template);
    setNameDraft(values.templateName);
    setTypeDraft(values.templateType);
  };

  const applyFormat = (before: string, after: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const selected = draft.slice(start, end);
    setDraft(draft.slice(0, start) + before + selected + after + draft.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = start + before.length;
      el.selectionEnd = start + before.length + selected.length;
    });
  };

  const applyListPrefix = (marker: (lineIndex: number) => string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const lineStart = draft.lastIndexOf("\n", start - 1) + 1;
    const nextBreak = draft.indexOf("\n", end);
    const lineEnd = nextBreak === -1 ? draft.length : nextBreak;
    const block = draft.slice(lineStart, lineEnd);
    const lines = block.split("\n");
    const newBlock = lines.map((line, i) => marker(i) + line).join("\n");
    setDraft(draft.slice(0, lineStart) + newBlock + draft.slice(lineEnd));
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = start + marker(0).length;
      el.selectionEnd = end + (newBlock.length - block.length);
    });
  };

  const insertAtCursor = (text: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    setDraft(draft.slice(0, start) + text + draft.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + text.length;
    });
  };

  const wordCount = useMemo(() => (draft.trim() ? draft.trim().split(/\s+/).length : 0), [draft]);
  const messageCount = Math.max(1, Math.ceil(draft.length / 300));
  const sizeHint = getSizeHint(draft.length);

  const isDirty =
    draft !== initial.template ||
    nameDraft !== initial.templateName ||
    typeDraft !== initial.templateType;

  return {
    draft,
    setDraft,
    nameDraft,
    setNameDraft,
    typeDraft,
    setTypeDraft,
    textareaRef,
    resetDrafts,
    applyFormat,
    applyListPrefix,
    insertAtCursor,
    wordCount,
    messageCount,
    sizeHint,
    isDirty,
  };
}
