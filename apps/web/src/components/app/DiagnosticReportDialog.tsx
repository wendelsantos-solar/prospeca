import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import type { DisplayLead, Lead } from "@/types";
import { buildDiagnosticReport } from "@/lib/diagnostic-report";
import { DiagnosticReportView } from "./DiagnosticReport";
import { useSettingsStore, useMessageStore } from "@/stores";
import { Button } from "@/components/ui/button";

/**
 * Full-screen white-label report preview. Renders through a portal to
 * <body> with class `.diagnostic-report` so the global @media print rules
 * (see styles.css) isolate it — "Baixar PDF" calls window.print(), which
 * prints ONLY the report. Closes on Escape / backdrop click.
 */
export function DiagnosticReportDialog({
  lead,
  open,
  onClose,
}: {
  lead: DisplayLead | null;
  open: boolean;
  onClose: () => void;
}) {
  const userName = useSettingsStore((s) => s.userName);
  const companyName = useSettingsStore((s) => s.companyName);
  const senderName = useSettingsStore((s) => s.senderName);
  const template = useMessageStore((s) => s.template);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("printing-report");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.classList.remove("printing-report");
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !lead) return null;

  const report = buildDiagnosticReport(lead, {
    branding: {
      authorName: senderName || userName || undefined,
      companyName: companyName || undefined,
    },
    template,
  });

  return createPortal(
    <div
      className="diagnostic-report fixed inset-0 z-[70] flex flex-col bg-slate-100"
      role="dialog"
      aria-modal="true"
      aria-label="Relatório de diagnóstico"
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 print:hidden">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-slate-900">
            Relatório de Diagnóstico
          </h2>
          <p className="truncate text-xs text-slate-500">{lead.companyName}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" />
            Baixar PDF
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Fechar relatório">
            <X className="h-4 w-4" />
            Fechar
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 print:overflow-visible print:p-0">
        <DiagnosticReportView report={report} />
      </div>
    </div>,
    document.body,
  );
}
