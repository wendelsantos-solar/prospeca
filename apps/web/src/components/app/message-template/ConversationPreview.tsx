import { Search, MoreVertical, CheckCheck, Smile, Paperclip, Mic } from "lucide-react";
import { renderFormattedMessage } from "./render-message";

interface ConversationPreviewProps {
  contactName: string;
  message: string;
  time: string;
}

export function ConversationPreview({ contactName, message, time }: ConversationPreviewProps) {
  const initials = contactName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <div className="overflow-hidden rounded-xl border shadow-sm">
      <div className="flex items-center gap-3 bg-[#008069] px-4 py-2.5 text-white">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-xs font-semibold">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">{contactName}</p>
          <p className="text-[11px] leading-tight text-white/80">online</p>
        </div>
        <Search className="h-4 w-4 shrink-0 opacity-90" />
        <MoreVertical className="h-4 w-4 shrink-0 opacity-90" />
      </div>

      <div
        className="min-h-[300px] px-4 py-5"
        style={{
          backgroundColor: "#efeae2",
          backgroundImage:
            "radial-gradient(circle at 15% 20%, rgba(0,0,0,0.015) 1.5px, transparent 1.5px), radial-gradient(circle at 65% 70%, rgba(0,0,0,0.015) 1.5px, transparent 1.5px)",
          backgroundSize: "40px 40px",
        }}
      >
        <div className="mb-3 flex justify-center">
          <span className="rounded-md bg-white/70 px-2.5 py-1 text-[11px] font-medium text-[#54656f] shadow-sm">
            Hoje
          </span>
        </div>
        <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-none bg-[#d9fdd3] px-3 py-2 shadow-sm">
          <p className="whitespace-pre-wrap text-sm text-[#111b21]">
            {renderFormattedMessage(message)}
          </p>
          <div className="mt-1 flex items-center justify-end gap-1">
            <span className="text-[10px] text-[#667781]">{time}</span>
            <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-[#f0f2f5] px-3 py-2">
        <Smile className="h-4 w-4 shrink-0 text-[#54656f]" />
        <Paperclip className="h-4 w-4 shrink-0 text-[#54656f]" />
        <div className="flex-1 rounded-full bg-white px-3 py-1.5 text-[12px] text-neutral-400 shadow-sm">
          Digite uma mensagem
        </div>
        <Mic className="h-4 w-4 shrink-0 text-[#54656f]" />
      </div>
    </div>
  );
}
