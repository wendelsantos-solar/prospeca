import { RotateCcw, Copy, CheckCircle2, Loader2 } from "lucide-react";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatLastEdited } from "./constants";

interface TemplateFooterProps {
  lastEditedAt: string | null;
  onRestore: () => void;
  onCancel: () => void;
  onCopy: () => void;
  onSave: () => void;
  saving: boolean;
}

export function TemplateFooter({
  lastEditedAt,
  onRestore,
  onCancel,
  onCopy,
  onSave,
  saving,
}: TemplateFooterProps) {
  return (
    <DialogFooter className="gap-2 sm:justify-between">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onRestore}>
          <RotateCcw className="mr-1 h-3.5 w-3.5" />
          Restaurar padrão
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Última edição: {formatLastEdited(lastEditedAt)}
        </p>
      </div>
      <div className="flex gap-2">
        <DialogClose asChild>
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
        </DialogClose>
        <Button variant="outline" size="sm" onClick={onCopy}>
          <Copy className="mr-1 h-3.5 w-3.5" />
          Copiar exemplo
        </Button>
        <Button onClick={onSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
          {saving ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
          )}
          Salvar modelo
        </Button>
      </div>
    </DialogFooter>
  );
}
