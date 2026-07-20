import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useMessageStore, type MessageTemplateType } from "@/stores";
import { toast } from "sonner";
import { DEFAULT_MESSAGE_TEMPLATE } from "@/lib/constants";
import { MessageTemplateHeader } from "./MessageTemplateHeader";
import { MessageEditor } from "./MessageEditor";
import { PreviewPanel } from "./PreviewPanel";
import { TemplateFooter } from "./TemplateFooter";
import { useMessageTemplateEditor } from "./useMessageTemplateEditor";
import { useTestLead } from "./useTestLead";

export function MessageTemplateModal() {
  const template = useMessageStore((s) => s.template);
  const templateName = useMessageStore((s) => s.templateName);
  const templateType = useMessageStore((s) => s.templateType);
  const lastEditedAt = useMessageStore((s) => s.lastEditedAt);
  const setTemplate = useMessageStore((s) => s.setTemplate);
  const setTemplateName = useMessageStore((s) => s.setTemplateName);
  const setTemplateType = useMessageStore((s) => s.setTemplateType);
  const reset = useMessageStore((s) => s.reset);

  const [saving, setSaving] = useState(false);

  const editor = useMessageTemplateEditor({ template, templateName, templateType });
  const testLead = useTestLead();

  const buildMessage = (mode: "real" | "missing") =>
    editor.draft.replace(/\{\{(\w+)\}\}/g, (match, name) => {
      const { value, hasRealData } = testLead.resolveVar(name);
      if (mode === "missing" && !hasRealData) return match;
      return value;
    });

  const message = buildMessage(testLead.dataMode);
  const contactName = testLead.testLead?.companyName ?? (editor.nameDraft.trim() || "Cliente");
  const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const usedVars = [...editor.draft.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
  const summaryRows = [...new Set(usedVars)].map((key) => ({
    key,
    ...testLead.resolveVar(key),
  }));

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(label);
  };

  const handleSave = () => {
    setSaving(true);
    window.setTimeout(() => {
      setTemplate(editor.draft);
      setTemplateName(editor.nameDraft.trim() || "Abordagem padrão");
      setTemplateType(editor.typeDraft as MessageTemplateType);
      setSaving(false);
      toast.success("Modelo salvo");
    }, 400);
  };

  const handleRestore = () => {
    setTemplate(DEFAULT_MESSAGE_TEMPLATE);
    setTemplateName("Abordagem padrão");
    setTemplateType("first_contact");
    reset();
    editor.resetDrafts({
      template: DEFAULT_MESSAGE_TEMPLATE,
      templateName: "Abordagem padrão",
      templateType: "first_contact",
    });
    toast.success("Modelo restaurado");
  };

  return (
    <Dialog
      onOpenChange={(open) => {
        if (open) {
          editor.resetDrafts({ template, templateName, templateType });
          testLead.setDataMode("real");
          return;
        }
        if (editor.isDirty) {
          const confirmClose = window.confirm(
            "Você tem alterações não salvas. Fechar mesmo assim?",
          );
          if (!confirmClose) return;
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="justify-start gap-2 w-full text-xs h-8">
          <MessageSquare className="h-3.5 w-3.5" />
          Editar mensagem
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-[1140px] flex-col overflow-y-auto rounded-2xl p-0 sm:rounded-2xl">
        <TooltipProvider delayDuration={300}>
          <div className="p-6 pb-0">
            <MessageTemplateHeader onCopy={() => handleCopy(editor.draft, "Modelo copiado")} />
          </div>
          <div className="grid flex-1 gap-0 overflow-y-auto p-6 md:grid-cols-[1.1fr_1fr]">
            <div className="md:pr-6">
              <MessageEditor
                nameDraft={editor.nameDraft}
                onNameChange={editor.setNameDraft}
                typeDraft={editor.typeDraft}
                onTypeChange={editor.setTypeDraft}
                draft={editor.draft}
                onDraftChange={editor.setDraft}
                textareaRef={editor.textareaRef}
                onFormat={editor.applyFormat}
                onList={editor.applyListPrefix}
                onInsertText={editor.insertAtCursor}
                onInsertVariable={(key) => editor.insertAtCursor(`{{${key}}}`)}
                onSaveShortcut={handleSave}
                wordCount={editor.wordCount}
                messageCount={editor.messageCount}
                sizeHint={editor.sizeHint}
              />
            </div>
            <div className="mt-6 border-t pt-6 md:mt-0 md:border-l md:border-t-0 md:pl-6 md:pt-0">
              <PreviewPanel
                leads={testLead.leads}
                testLead={testLead.testLead}
                testLeadIndex={testLead.testLeadIndex}
                onTestLeadChange={testLead.setTestLeadIndex}
                dataMode={testLead.dataMode}
                onDataModeChange={testLead.setDataMode}
                switching={testLead.switching}
                contactName={contactName}
                message={message}
                time={time}
                summaryRows={summaryRows}
              />
            </div>
          </div>
          <TemplateFooter
            lastEditedAt={lastEditedAt}
            onRestore={handleRestore}
            onCancel={() => {}}
            onCopy={() => handleCopy(message, "Exemplo copiado")}
            onSave={handleSave}
            saving={saving}
          />
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
}
