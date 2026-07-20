import { useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Trash2, Download, Upload, RotateCcw } from "lucide-react";
import { Label } from "@/components/ui/label";
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

export function SettingsDialog() {
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
    window.dispatchEvent(new CustomEvent("retry-search"));
    toast.success("Dados de demonstração sendo restaurados...");
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Configurações">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurações</DialogTitle>
          <DialogDescription>
            Ajuste preferências, modelo de mensagem e exportação de dados.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="general">
          <TabsList className="flex-wrap">
            <TabsTrigger value="general">Geral</TabsTrigger>
            <TabsTrigger value="prospect">Prospecção</TabsTrigger>
            <TabsTrigger value="messages">Mensagens</TabsTrigger>
            <TabsTrigger value="data">Dados</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-3 mt-4">
            <div>
              <Label htmlFor="set-user">Nome do usuário</Label>
              <Input
                id="set-user"
                placeholder="Seu nome"
                value={settings.userName}
                onChange={(e) => settings.set({ userName: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="set-company">Nome da empresa</Label>
              <Input
                id="set-company"
                placeholder="Sua empresa"
                value={settings.companyName}
                onChange={(e) => settings.set({ companyName: e.target.value })}
              />
            </div>
            <div>
              <Label>Tema</Label>
              <div className="mt-1 flex gap-2">
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
            </div>
            <div>
              <Label>Densidade</Label>
              <div className="mt-1 flex gap-2">
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
            </div>
            <div>
              <Label>Formato de moeda</Label>
              <Select value="BRL" disabled>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">Real brasileiro (R$)</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Outras moedas em versões futuras.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="prospect" className="space-y-3 mt-4">
            <div>
              <Label htmlFor="set-limit">Limite de seleção em massa</Label>
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
              />
            </div>
            <div>
              <Label>Filtro padrão de presença digital</Label>
              <Select
                value={settings.defaultPresence}
                onValueChange={(v) => settings.set({ defaultPresence: v as PresenceFilter })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no-website">Sem site</SelectItem>
                  <SelectItem value="with-website">Com site</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Raio padrão</Label>
              <Select
                value={String(settings.defaultRadius)}
                onValueChange={(v) => settings.set({ defaultRadius: Number(v) })}
              >
                <SelectTrigger>
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
            </div>
            <div>
              <Label>Ordenação padrão</Label>
              <Select
                value={settings.defaultSort}
                onValueChange={(v) => settings.set({ defaultSort: v as SortValue })}
              >
                <SelectTrigger>
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
            </div>
          </TabsContent>

          <TabsContent value="messages" className="space-y-3 mt-4">
            <div>
              <Label htmlFor="set-template">Modelo padrão do WhatsApp</Label>
              <Textarea
                id="set-template"
                rows={4}
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="set-sender">Nome do remetente</Label>
              <Input
                id="set-sender"
                placeholder="Como você se apresenta"
                value={settings.senderName}
                onChange={(e) => settings.set({ senderName: e.target.value })}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Substitui a variável {"{{meu_nome}}"} nas mensagens.
              </p>
            </div>
            <div>
              <Label htmlFor="set-signature">Assinatura</Label>
              <Textarea
                id="set-signature"
                rows={2}
                placeholder="Assinatura anexada ao final das mensagens"
                value={settings.signature}
                onChange={(e) => settings.set({ signature: e.target.value })}
              />
            </div>
          </TabsContent>

          <TabsContent value="data" className="space-y-3 mt-4">
            <p className="text-sm text-muted-foreground">
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
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
