import { useRef, useState } from "react";
import { useSearchSession } from "@/stores/searchSession";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Trash2, Download, Upload, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUIStore, useSettingsStore, useMessageStore, useLeadsStore } from "@/stores";
import { clearAllState } from "@/lib/storage";
import { RADIUS_OPTIONS, SORT_OPTIONS, STORAGE_KEY, type SortValue } from "@/lib/constants";
import type { PresenceFilter } from "@/types";
import { toast } from "sonner";

function Row({
  label,
  desc,
  children,
}: {
  label: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface p-3">
      <div>
        <div className="text-[13px] font-medium">{label}</div>
        <div className="text-[11.5px] text-muted-foreground">{desc}</div>
      </div>
      {children}
    </div>
  );
}

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const density = useUIStore((s) => s.density);
  const setDensity = useUIStore((s) => s.setDensity);
  const settings = useSettingsStore();
  const template = useMessageStore((s) => s.template);
  const setTemplate = useMessageStore((s) => s.setTemplate);
  const resetLeads = useLeadsStore((s) => s.reset);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const exportBackup = () => {
    try {
      const data: Record<string, string> = {};
      Object.keys(window.localStorage)
        .filter((k) => k.startsWith(STORAGE_KEY))
        .forEach((k) => {
          data[k] = window.localStorage.getItem(k)!;
        });
      const blob = new Blob(
        [JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data }, null, 2)],
        { type: "application/json" },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `radar-local-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup exportado");
    } catch {
      toast.error("Falha ao exportar backup");
    }
  };

  const importBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as {
          version: number;
          data: Record<string, string>;
        };
        if (!parsed.data) throw new Error("invalid");
        Object.entries(parsed.data).forEach(([k, v]) => window.localStorage.setItem(k, v));
        toast.success("Backup importado. Recarregue a página para aplicar.");
      } catch {
        toast.error("Arquivo de backup inválido");
      }
    };
    reader.readAsText(file);
  };

  const restoreDemo = () => {
    resetLeads();
    useSearchSession.getState().retrySearch();
    toast.success("Dados de demonstração sendo restaurados...");
  };

  const handleSave = () => {
    toast.success("Configurações salvas");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        aria-label="Configurações"
        onClick={() => setOpen(true)}
      >
        <Settings className="h-4 w-4" />
      </Button>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="text-[15px]">Configurações</DialogTitle>
          <DialogDescription className="text-[12px] text-muted-foreground">
            Ajuste como o Radar Local funciona para você.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="general" className="px-6 py-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="general">Geral</TabsTrigger>
            <TabsTrigger value="prospect">Prospecção</TabsTrigger>
            <TabsTrigger value="messages">Mensagens</TabsTrigger>
            <TabsTrigger value="data">Dados</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-4 space-y-4">
            <Row label="Nome do usuário" desc="Aparece como responsável dos leads.">
              <Input
                id="set-user"
                placeholder="Seu nome"
                value={settings.userName}
                onChange={(e) => settings.set({ userName: e.target.value })}
                className="w-48"
              />
            </Row>
            <Row label="Nome da empresa" desc="Usado nas mensagens e exportações.">
              <Input
                id="set-company"
                placeholder="Sua empresa"
                value={settings.companyName}
                onChange={(e) => settings.set({ companyName: e.target.value })}
                className="w-48"
              />
            </Row>
            <Row label="Tema" desc="Aparência da interface.">
              <div className="flex gap-2">
                {(["light", "dark"] as const).map((t) => (
                  <Button
                    key={t}
                    size="sm"
                    variant={theme === t ? "default" : "outline"}
                    onClick={() => theme !== t && toggleTheme()}
                  >
                    {t === "light" ? "Claro" : "Escuro"}
                  </Button>
                ))}
              </div>
            </Row>
            <Row label="Densidade" desc="Compactação da lista de leads.">
              <div className="flex gap-2">
                {(["compact", "comfortable"] as const).map((d) => (
                  <Button
                    key={d}
                    size="sm"
                    variant={density === d ? "default" : "outline"}
                    onClick={() => setDensity(d)}
                  >
                    {d === "compact" ? "Compacto" : "Confortável"}
                  </Button>
                ))}
              </div>
            </Row>
            <Row label="Formato de moeda" desc="Outras moedas em versões futuras.">
              <Select value="BRL" disabled>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">Real brasileiro (R$)</SelectItem>
                </SelectContent>
              </Select>
            </Row>
          </TabsContent>

          <TabsContent value="prospect" className="mt-4 space-y-4">
            <Row
              label="Limite de seleção em massa"
              desc="Máximo de leads selecionáveis de uma vez."
            >
              <Input
                id="set-limit"
                type="number"
                min={1}
                max={50}
                value={settings.bulkLimit}
                onChange={(e) =>
                  settings.set({
                    bulkLimit: Math.max(1, Math.min(50, Number(e.target.value) || 10)),
                  })
                }
                className="w-24"
              />
            </Row>
            <Row label="Filtro padrão de presença digital" desc="Aplicado ao abrir uma nova busca.">
              <Select
                value={settings.defaultPresence}
                onValueChange={(v) => settings.set({ defaultPresence: v as PresenceFilter })}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no-website">Sem site</SelectItem>
                  <SelectItem value="with-website">Com site</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <Row label="Raio padrão" desc="Raio de busca inicial no mapa.">
              <Select
                value={String(settings.defaultRadius)}
                onValueChange={(v) => settings.set({ defaultRadius: Number(v) })}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RADIUS_OPTIONS.map((r) => (
                    <SelectItem key={r} value={String(r)}>
                      {r} km
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
            <Row label="Ordenação padrão" desc="Ordem inicial dos resultados de busca.">
              <Select
                value={settings.defaultSort}
                onValueChange={(v) => settings.set({ defaultSort: v as SortValue })}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
          </TabsContent>

          <TabsContent value="messages" className="mt-4 space-y-4">
            <div>
              <div className="text-[13px] font-medium">Modelo padrão do WhatsApp</div>
              <div className="text-[11.5px] text-muted-foreground">
                Texto usado ao iniciar uma conversa pelo WhatsApp.
              </div>
              <Textarea
                id="set-template"
                rows={4}
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="mt-2"
              />
            </div>
            <Row
              label="Nome do remetente"
              desc={`Substitui a variável {{meu_nome}} nas mensagens.`}
            >
              <Input
                id="set-sender"
                placeholder="Como você se apresenta"
                value={settings.senderName}
                onChange={(e) => settings.set({ senderName: e.target.value })}
                className="w-48"
              />
            </Row>
            <div>
              <div className="text-[13px] font-medium">Assinatura</div>
              <div className="text-[11.5px] text-muted-foreground">
                Anexada ao final das mensagens enviadas.
              </div>
              <Textarea
                id="set-signature"
                rows={2}
                placeholder="Assinatura anexada ao final das mensagens"
                value={settings.signature}
                onChange={(e) => settings.set({ signature: e.target.value })}
                className="mt-2"
              />
            </div>
          </TabsContent>

          <TabsContent value="data" className="mt-4 space-y-4">
            <p className="text-[11.5px] text-muted-foreground">
              Gerencie os dados locais desta demonstração.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={exportBackup} className="gap-1.5">
                <Download className="h-4 w-4" />
                Exportar dados locais
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                className="gap-1.5"
              >
                <Upload className="h-4 w-4" />
                Importar backup
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importBackup(f);
                  e.target.value = "";
                }}
                aria-label="Importar arquivo de backup"
              />
              <Button variant="outline" size="sm" onClick={restoreDemo} className="gap-1.5">
                <RotateCcw className="h-4 w-4" />
                Restaurar demonstração
              </Button>
            </div>
            <div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  clearAllState();
                  toast.success("Dados limpos. Recarregue a página.");
                }}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Limpar todos os dados
              </Button>
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                Isso remove leads, pipeline e histórico deste dispositivo.
              </p>
            </div>
          </TabsContent>
        </Tabs>
        <DialogFooter className="border-t border-border px-6 py-3">
          <button
            onClick={() => setOpen(false)}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] font-medium hover:border-border-strong"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="rounded-md bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-foreground hover:bg-primary-hover"
          >
            Salvar alterações
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
