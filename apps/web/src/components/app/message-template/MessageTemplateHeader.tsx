import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MessageCircle, CheckCircle2, ChevronDown, Copy } from "lucide-react";

interface MessageTemplateHeaderProps {
  onCopy: () => void;
}

export function MessageTemplateHeader({ onCopy }: MessageTemplateHeaderProps) {
  return (
    <DialogHeader className="flex-row items-start justify-between gap-3 space-y-0 pr-6">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white">
          <MessageCircle className="h-4.5 w-4.5" />
        </div>
        <div>
          <DialogTitle>Modelo de mensagem do WhatsApp</DialogTitle>
          <DialogDescription>
            Crie mensagens reutilizáveis e personalize automaticamente utilizando os dados dos seus
            leads.
          </DialogDescription>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge
          variant="outline"
          className="gap-1 border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
        >
          <CheckCircle2 className="h-3 w-3" />
          Modelo padrão
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              Mais ações
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onCopy}>
              <Copy className="mr-2 h-3.5 w-3.5" />
              Copiar modelo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </DialogHeader>
  );
}
