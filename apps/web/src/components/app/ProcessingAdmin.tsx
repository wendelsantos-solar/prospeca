import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw, Inbox } from "lucide-react";
import { invokeFunction } from "@/lib/supabase";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { cn } from "@/lib/utils";

interface JobCounts {
  total: number;
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  deadLetter: number;
}

interface JobRow {
  id: string;
  type: string;
  status: string;
  attempt: number;
  priority: number;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  organization_name: string | null;
  place_name: string | null;
}

interface JobsData {
  counts: JobCounts;
  jobs: JobRow[];
}

const STATUS_LABEL: Record<string, string> = {
  queued: "Na fila",
  processing: "Processando",
  completed: "Concluído",
  partially_completed: "Parcial",
  failed: "Falhou",
  retrying: "Reprocessando",
  cancelled: "Cancelado",
};

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "completed"
      ? "default"
      : status === "failed"
        ? "destructive"
        : status === "processing" || status === "retrying"
          ? "secondary"
          : "outline";
  return <Badge variant={variant}>{STATUS_LABEL[status] ?? status}</Badge>;
}

function CountCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "muted" | "info" | "success" | "warn" | "error";
}) {
  const color =
    tone === "success"
      ? "text-primary"
      : tone === "warn"
        ? "text-warning-foreground"
        : tone === "error"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-surface p-3.5">
      <div className="text-[11.5px] font-medium text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-[18px] font-semibold", color)}>{value}</div>
    </div>
  );
}

export function ProcessingAdmin() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery<JobsData>({
    queryKey: ["admin-jobs"],
    queryFn: () => invokeFunction<JobsData>("get-admin-jobs", {}),
    retry: false,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  const retry = async (jobId: string) => {
    try {
      await invokeFunction("retry-job", { jobId });
      toast.success("Job reencaminhado para reprocessamento");
      await queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
    } catch {
      toast.error("Falha ao reprocessar job");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando pipeline…
      </div>
    );
  }
  if (error) {
    return (
      <div className="text-sm text-muted-foreground">Não foi possível carregar o pipeline.</div>
    );
  }

  const c = data?.counts;
  const columns: DataTableColumn<JobRow>[] = [
    {
      key: "type",
      label: "Tipo",
      sortValue: (r) => r.type,
      render: (r) => <span className="font-mono text-[11px]">{r.type}</span>,
    },
    {
      key: "status",
      label: "Status",
      sortValue: (r) => r.status,
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "place",
      label: "Empresa",
      render: (r) => <span className="text-muted-foreground">{r.place_name ?? "—"}</span>,
    },
    {
      key: "org",
      label: "Organização",
      render: (r) => <span className="text-muted-foreground">{r.organization_name ?? "—"}</span>,
    },
    {
      key: "attempt",
      label: "Tent.",
      align: "right",
      sortValue: (r) => r.attempt,
      render: (r) => r.attempt,
    },
    {
      key: "created",
      label: "Criado",
      sortValue: (r) => r.created_at,
      render: (r) => (
        <span className="text-muted-foreground">
          {new Date(r.created_at).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      ),
    },
    {
      key: "error",
      label: "Erro",
      render: (r) =>
        r.error ? (
          <span className="line-clamp-1 max-w-[180px] text-[11px] text-destructive">{r.error}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "action",
      label: "",
      render: (r) =>
        r.status === "failed" ? (
          <Button size="sm" variant="outline" onClick={() => retry(r.id)}>
            <RotateCcw className="h-3.5 w-3.5" /> Reprocessar
          </Button>
        ) : (
          <span />
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <CountCard label="Na fila" value={c?.queued ?? 0} tone="muted" />
        <CountCard label="Processando" value={c?.processing ?? 0} tone="info" />
        <CountCard label="Concluídos" value={c?.completed ?? 0} tone="success" />
        <CountCard label="Falhas" value={c?.failed ?? 0} tone="warn" />
        <CountCard label="Dead-letter" value={c?.deadLetter ?? 0} tone="error" />
      </div>
      <div className="rounded-xl border border-border bg-surface p-4">
        <DataTable
          columns={columns}
          data={data?.jobs ?? []}
          rowKey={(r) => r.id}
          pageSize={15}
          emptyIcon={Inbox}
          emptyTitle="Nenhum job ainda"
          emptyDescription="Assim que o enriquecimento rodar, os jobs aparecem aqui."
        />
      </div>
    </div>
  );
}
