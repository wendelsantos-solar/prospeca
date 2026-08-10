import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Download, Upload, RotateCcw, Trash2, AlertTriangle } from "lucide-react";
import { isDemoMode } from "@/lib/env";
import { getSupabase, invokeFunction } from "@/lib/supabase";
import { fetchAccountContext } from "@/lib/account";
import { useLeadsStore } from "@/stores";
import { useSearchSession } from "@/stores/searchSession";
import { clearAllState } from "@/lib/storage";
import { STORAGE_KEY } from "@/lib/constants";

export function SecurityDataSettings() {
  const resetLeads = useLeadsStore((s) => s.reset);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: account } = useQuery({
    queryKey: ["account-context"],
    queryFn: fetchAccountContext,
    enabled: !isDemoMode,
  });

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
        toast.success("Backup importado. Recarregue a página.");
      } catch {
        toast.error("Arquivo de backup inválido");
      }
    };
    reader.readAsText(file);
  };

  const restoreDemo = () => {
    resetLeads();
    useSearchSession.getState().retrySearch();
    toast.success("Dados de demonstração restaurados.");
  };

  const requestAccountDeletion = async () => {
    if (!account) {
      toast.error("Organização não identificada. Recarregue.");
      return;
    }
    setDeleting(true);
    try {
      await invokeFunction("delete-account-data", {
        confirm: "EXCLUIR",
        organizationId: account.organizationId,
      });
      toast.success("Conta excluída. Desconectando…");
      setDeleteOpen(false);
      await getSupabase().auth.signOut();
      window.location.href = "/";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao excluir conta");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Backup local */}
      <div className="space-y-4">
        <div>
          <div className="text-[13px] font-semibold text-foreground">Backup local</div>
          <div className="text-[11.5px] text-muted-foreground">
            Exporte ou importe dados deste dispositivo.
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface px-4 py-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportBackup} className="gap-1.5">
              <Download className="h-4 w-4" /> Exportar dados
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              className="gap-1.5"
            >
              <Upload className="h-4 w-4" /> Importar backup
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
            {isDemoMode && (
              <Button variant="outline" size="sm" onClick={restoreDemo} className="gap-1.5">
                <RotateCcw className="h-4 w-4" /> Restaurar demonstração
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Limpeza local */}
      <div className="space-y-4">
        <div>
          <div className="text-[13px] font-semibold text-foreground">Limpeza local</div>
          <div className="text-[11.5px] text-muted-foreground">
            Remove dados deste navegador — não afeta sua conta.
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface px-4 py-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              clearAllState();
              toast.success("Dados limpos. Recarregue a página.");
            }}
          >
            <Trash2 className="mr-1.5 h-4 w-4" /> Limpar dados deste dispositivo
          </Button>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Remove leads, pipeline e histórico salvos neste navegador.
          </p>
        </div>
      </div>

      {/* Zona de perigo */}
      <div className="rounded-xl border border-destructive/30 bg-destructive-soft/40 px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-destructive">Excluir minha conta</div>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
              Remove permanentemente seus dados da plataforma. Não afeta só este dispositivo — é a
              conta inteira.
            </p>
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm" className="mt-3">
                  Excluir minha conta
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Excluir sua conta</DialogTitle>
                  <DialogDescription>
                    Essa ação não pode ser desfeita. Digite{" "}
                    <span className="font-mono">EXCLUIR</span> para confirmar.
                  </DialogDescription>
                </DialogHeader>
                <Input
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="EXCLUIR"
                />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={deleteConfirm !== "EXCLUIR" || deleting}
                    onClick={requestAccountDeletion}
                  >
                    {deleting ? "Excluindo…" : "Excluir permanentemente"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </div>
  );
}
