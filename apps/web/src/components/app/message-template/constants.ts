import { Send, RefreshCw, Undo2, Flame, FileText, Sparkles } from "lucide-react";
import type { MessageTemplateType } from "@/stores";

export interface VarDef {
  key: string;
  label: string;
}

export const LEAD_VAR_DEFS: VarDef[] = [
  { key: "empresa", label: "Empresa" },
  { key: "responsavel", label: "Responsável" },
  { key: "categoria", label: "Categoria" },
  { key: "cidade", label: "Cidade" },
  { key: "bairro", label: "Bairro" },
  { key: "telefone", label: "Telefone" },
  { key: "instagram", label: "Instagram" },
  { key: "website", label: "Website" },
];

export const SENDER_VAR_DEFS: VarDef[] = [
  { key: "meu_nome", label: "Meu nome" },
  { key: "minha_empresa", label: "Minha empresa" },
  { key: "telefone_remetente", label: "Telefone" },
  { key: "site_remetente", label: "Site" },
  { key: "assinatura", label: "Assinatura" },
];

export const TEMPLATE_TYPES: { value: MessageTemplateType; label: string; icon: typeof Send }[] = [
  { value: "first_contact", label: "Primeira abordagem", icon: Send },
  { value: "follow_up", label: "Follow-up", icon: RefreshCw },
  { value: "return", label: "Retorno", icon: Undo2 },
  { value: "reengagement", label: "Reativação", icon: Flame },
  { value: "proposal", label: "Proposta", icon: FileText },
  { value: "custom", label: "Personalizado", icon: Sparkles },
];

export const FORMAT_BUTTONS = [
  { id: "bold", label: "Negrito", before: "*", after: "*", shortcut: "*texto*" },
  { id: "italic", label: "Itálico", before: "_", after: "_", shortcut: "_texto_" },
  { id: "strike", label: "Tachado", before: "~", after: "~", shortcut: "~texto~" },
  { id: "code", label: "Código", before: "```", after: "```", shortcut: "```texto```" },
] as const;

export const EMOJI_OPTIONS = ["😊", "👋", "🙏", "✅", "🚀", "💬", "📈", "🔥"];

export const MESSAGE_CHAR_LIMIT = 300;

export function getSizeHint(length: number) {
  if (length <= MESSAGE_CHAR_LIMIT) {
    return {
      label: "Ótimo tamanho para WhatsApp",
      tone: "text-emerald-700 dark:text-emerald-400",
      bg: "bg-emerald-600/10",
      dot: "bg-emerald-500",
    };
  }
  if (length <= MESSAGE_CHAR_LIMIT * 2) {
    return {
      label: "Mensagem longa",
      tone: "text-amber-700 dark:text-amber-400",
      bg: "bg-amber-600/10",
      dot: "bg-amber-500",
    };
  }
  return {
    label: "Pode reduzir a taxa de resposta",
    tone: "text-destructive",
    bg: "bg-destructive/10",
    dot: "bg-destructive",
  };
}

export function formatLastEdited(iso: string | null) {
  if (!iso) return "Ainda não salvo";
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return isToday ? `Hoje às ${time}` : `${d.toLocaleDateString("pt-BR")} às ${time}`;
}
