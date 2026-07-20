import { Info, Lightbulb } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { LEAD_VAR_DEFS, SENDER_VAR_DEFS, type VarDef } from "./constants";

interface VariableSectionProps {
  onInsert: (key: string) => void;
}

function VarGroup({
  title,
  vars,
  onInsert,
}: {
  title: string;
  vars: VarDef[];
  onInsert: (key: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {vars.map(({ key, label }) => (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`Inserir ${label}`}
                className="rounded-md border border-emerald-500/25 bg-emerald-600/10 px-2 py-1 font-mono text-[11px] text-emerald-700 transition-colors hover:border-emerald-500/50 hover:bg-emerald-600/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-emerald-400"
                onClick={() => onInsert(key)}
              >
                {`{{${key}}}`}
              </button>
            </TooltipTrigger>
            <TooltipContent>Insere {label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}

export function VariableSection({ onInsert }: VariableSectionProps) {
  return (
    <div>
      <div className="flex items-center gap-1">
        <Label className="text-xs">Variáveis disponíveis</Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Info className="h-3 w-3 text-muted-foreground" />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            Variáveis são substituídas automaticamente pelos dados do lead ao enviar
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="mt-1.5 overflow-hidden rounded-lg border">
        <div className="grid grid-cols-2 gap-4 p-3">
          <VarGroup title="Dados do lead" vars={LEAD_VAR_DEFS} onInsert={onInsert} />
          <VarGroup title="Dados do remetente" vars={SENDER_VAR_DEFS} onInsert={onInsert} />
        </div>
        <div className="flex items-center gap-1.5 border-t bg-amber-500/10 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-300">
          <Lightbulb className="h-3.5 w-3.5 shrink-0" />
          Clique em qualquer variável para inseri-la na posição atual do cursor.
        </div>
      </div>
    </div>
  );
}
