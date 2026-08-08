// Pilot management section for the admin panel.
// Allows admins to: view pilot orgs, create pilot access, extend/end pilots.

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { invokeFunction, getSupabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Users, Clock, CheckCircle, XCircle, Plus } from "lucide-react";

interface PilotOrg {
  org_id: string;
  name: string;
  owner_email: string;
  pilot_status: string;
  pilot_started_at: string | null;
  pilot_ends_at: string | null;
  plan: string;
  searches: number;
  last_activity: string | null;
  total_leads: number;
  active_days_7: number;
}

interface PilotStats {
  totalInvited: number;
  active: number;
  onboarding: number;
  completed: number;
  converted: number;
  expired: number;
}

function PilotStatusBadge({ status }: { status: string | null }) {
  const map: Record<
    string,
    { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
  > = {
    invited: { label: "Convidado", variant: "secondary" },
    onboarding: { label: "Onboarding", variant: "outline" },
    active: { label: "Ativo", variant: "default" },
    inactive: { label: "Inativo", variant: "secondary" },
    completed: { label: "Concluído", variant: "outline" },
    converted: { label: "Convertido", variant: "default" },
    declined: { label: "Recusou", variant: "destructive" },
    expired: { label: "Expirado", variant: "destructive" },
  };
  const info = map[status ?? ""] ?? { label: status ?? "—", variant: "secondary" as const };
  return <Badge variant={info.variant}>{info.label}</Badge>;
}

export function PilotManagement() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [durationDays, setDurationDays] = useState("30");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);
  // The invitation e-mail depends on RESEND_API_KEY being configured — when
  // it isn't, sendEmail() no-ops silently and the admin has no other way to
  // reach the invitee. Always surface the link so it can be copied by hand.
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ pilots: PilotOrg[]; stats: PilotStats }>({
    queryKey: ["admin-pilots"],
    queryFn: async () => {
      const supabase = getSupabase();
      const { data: orgs, error } = await supabase
        .from("organizations")
        .select(
          `
          id, name, plan, pilot_status, pilot_started_at, pilot_ends_at,
          pilot_notes, created_at,
          organization_members!inner(user_id)
        `,
        )
        .in("plan", ["pilot"])
        .or("pilot_status.not.is.null")
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      // Get owner emails (in a real app, do this server-side)
      const pilots: PilotOrg[] = (orgs ?? []).map((org: Record<string, unknown>) => {
        const members = org.organization_members as Array<{ user_id: string }> | undefined;
        return {
          org_id: org.id as string,
          name: org.name as string,
          owner_email: "", // Would need a separate query
          pilot_status: org.pilot_status as string,
          pilot_started_at: org.pilot_started_at as string | null,
          pilot_ends_at: org.pilot_ends_at as string | null,
          plan: org.plan as string,
          searches: 0,
          last_activity: null,
          total_leads: 0,
          active_days_7: 0,
        };
      });

      const stats: PilotStats = {
        totalInvited: pilots.length,
        active: pilots.filter((p) => p.pilot_status === "active").length,
        onboarding: pilots.filter((p) => p.pilot_status === "onboarding").length,
        completed: pilots.filter((p) => p.pilot_status === "completed").length,
        converted: pilots.filter((p) => p.pilot_status === "converted").length,
        expired: pilots.filter((p) => p.pilot_status === "expired").length,
      };

      return { pilots, stats };
    },
    staleTime: 60_000,
  });

  const handleCreatePilot = async () => {
    if (!email.trim() || !orgName.trim()) {
      toast.error("Preencha e-mail e nome da organização.");
      return;
    }
    setCreating(true);
    try {
      await invokeFunction("create-pilot", {
        email: email.trim(),
        organizationName: orgName.trim(),
        durationDays: Number(durationDays),
        notes: notes.trim() || undefined,
        source: "admin_panel",
      });
      toast.success(`Piloto criado! Convite enviado para ${email}.`);
      setCreateOpen(false);
      setEmail("");
      setOrgName("");
      setDurationDays("30");
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["admin-pilots"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar piloto.");
    } finally {
      setCreating(false);
    }
  };

  const handleExtend = async (orgId: string) => {
    try {
      const newEnd = new Date();
      newEnd.setDate(newEnd.getDate() + 15);
      await getSupabase()
        .from("organizations")
        .update({ pilot_ends_at: newEnd.toISOString() })
        .eq("id", orgId);
      toast.success("Piloto prorrogado por 15 dias.");
      queryClient.invalidateQueries({ queryKey: ["admin-pilots"] });
    } catch {
      toast.error("Erro ao prorrogar.");
    }
  };

  const handleEnd = async (orgId: string) => {
    try {
      await getSupabase()
        .from("organizations")
        .update({ pilot_status: "completed" })
        .eq("id", orgId);
      toast.success("Piloto encerrado.");
      queryClient.invalidateQueries({ queryKey: ["admin-pilots"] });
    } catch {
      toast.error("Erro ao encerrar.");
    }
  };

  const columns: DataTableColumn<PilotOrg>[] = [
    { key: "name", label: "Organização", sortValue: (r) => r.name, render: (r) => r.name },
    {
      key: "pilot_status",
      label: "Status",
      sortValue: (r) => r.pilot_status,
      render: (r) => <PilotStatusBadge status={r.pilot_status} />,
    },
    {
      key: "pilot_ends_at",
      label: "Expira em",
      sortValue: (r) => r.pilot_ends_at ?? "",
      render: (r) => {
        if (!r.pilot_ends_at) return <span className="text-muted-foreground">—</span>;
        const end = new Date(r.pilot_ends_at);
        const days = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return (
          <span className={cn(days <= 7 && "font-medium text-destructive")}>
            {end.toLocaleDateString("pt-BR")}
            {days > 0 && <span className="ml-1 text-muted-foreground">({days}d)</span>}
          </span>
        );
      },
    },
    {
      key: "actions",
      label: "Ações",
      sortValue: () => "",
      render: (r) => (
        <div className="flex items-center gap-1">
          {r.pilot_status === "active" && (
            <>
              <Button size="sm" variant="outline" onClick={() => handleExtend(r.org_id)}>
                <Clock className="mr-1 h-3 w-3" /> +15d
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleEnd(r.org_id)}>
                <CheckCircle className="mr-1 h-3 w-3" /> Encerrar
              </Button>
            </>
          )}
          {r.pilot_status === "invited" && (
            <Button size="sm" variant="outline" onClick={() => handleEnd(r.org_id)}>
              <XCircle className="mr-1 h-3 w-3" /> Cancelar
            </Button>
          )}
        </div>
      ),
    },
  ];

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando pilotos...</p>;
  }

  return (
    <div className="space-y-4">
      {/* Stats row */}
      {data?.stats && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <StatCard label="Total" value={data.stats.totalInvited} icon={Users} />
          <StatCard label="Ativos" value={data.stats.active} icon={Users} tone="success" />
          <StatCard label="Onboarding" value={data.stats.onboarding} icon={Clock} tone="warn" />
          <StatCard label="Concluídos" value={data.stats.completed} icon={CheckCircle} />
          <StatCard
            label="Convertidos"
            value={data.stats.converted}
            icon={CheckCircle}
            tone="success"
          />
          <StatCard label="Expirados" value={data.stats.expired} icon={XCircle} tone="warn" />
        </div>
      )}

      {/* Create pilot button */}
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-semibold">Organizações piloto</h3>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-3.5 w-3.5" /> Novo piloto
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar acesso piloto</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pilot-email">E-mail do usuário</Label>
                <Input
                  id="pilot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pilot-org">Nome da organização</Label>
                <Input
                  id="pilot-org"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Empresa do Piloto"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pilot-duration">Duração (dias)</Label>
                <Select value={durationDays} onValueChange={setDurationDays}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 dias</SelectItem>
                    <SelectItem value="30">30 dias</SelectItem>
                    <SelectItem value="60">60 dias</SelectItem>
                    <SelectItem value="90">90 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pilot-notes">Observações internas</Label>
                <Textarea
                  id="pilot-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Origem, contexto, etc."
                  rows={2}
                />
              </div>
              <Button onClick={handleCreatePilot} disabled={creating} className="w-full">
                {creating ? "Criando..." : "Criar piloto"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pilot table */}
      <DataTable
        columns={columns}
        data={data?.pilots ?? []}
        rowKey={(r) => r.org_id}
        emptyIcon={Users}
        emptyTitle="Nenhum piloto ainda"
        emptyDescription="Crie o primeiro acesso piloto para começar o beta."
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "success" | "warn";
}) {
  const color =
    tone === "success"
      ? "text-primary"
      : tone === "warn"
        ? "text-warning-foreground"
        : "text-muted-foreground";
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-3.5 w-3.5", color)} />
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <p className="mt-1 text-[18px] font-semibold">{value}</p>
    </div>
  );
}
