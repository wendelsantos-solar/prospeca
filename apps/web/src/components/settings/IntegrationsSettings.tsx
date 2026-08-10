import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plug,
  CalendarDays,
  Video,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  Clock3,
  BellRing,
  MessageSquare,
  Webhook,
  ArrowUpRight,
} from "lucide-react";
import { isDemoMode } from "@/lib/env";
import {
  useConnectGoogleCalendar,
  useDisconnectGoogleCalendar,
  useGoogleCalendarStatus,
} from "@/hooks/useGoogleCalendar";
import { cn } from "@/lib/utils";

function readSettingsSearch() {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  return {
    integration: params.get("integration") ?? undefined,
    integrationMessage: params.get("integration_message") ?? undefined,
  };
}

export function IntegrationsSettings() {
  const search = readSettingsSearch();
  const callbackHandled = useRef(false);
  const statusQuery = useGoogleCalendarStatus();
  const connectMutation = useConnectGoogleCalendar();
  const disconnectMutation = useDisconnectGoogleCalendar();
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const connection = statusQuery.data?.connection;
  const isLoading = statusQuery.isLoading;

  useEffect(() => {
    if (callbackHandled.current || !search.integration) return;
    callbackHandled.current = true;
    if (search.integration === "google-calendar-connected") {
      toast.success("Google Calendar conectado com sucesso");
    } else if (search.integration === "google-calendar-error") {
      toast.error(search.integrationMessage || "Não foi possível conectar o Google Calendar");
    }
  }, [search.integration, search.integrationMessage]);

  const connect = () =>
    connectMutation.mutate("/app/configuracoes/integracoes", {
      onError: (error) => toast.error(error.message),
    });

  const disconnect = () =>
    disconnectMutation.mutate(undefined, {
      onSuccess: () => {
        setDisconnectOpen(false);
        toast.success("Google Calendar desconectado");
      },
      onError: (error) => toast.error(error.message),
    });

  const statusBadge = () => {
    if (isDemoMode)
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          Demonstração
        </span>
      );
    if (isLoading)
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Verificando
        </span>
      );
    if (statusQuery.isError)
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive">
          <AlertTriangle className="h-3 w-3" /> Erro
        </span>
      );
    if (connection?.status === "connected")
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">
          <CheckCircle2 className="h-3 w-3" /> Conectado
        </span>
      );
    if (connection)
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive">
          <X className="h-3 w-3" /> Reconexão
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
        Não conectado
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl border border-primary/15 bg-gradient-to-br from-primary-soft/60 via-primary-subtle/40 to-surface px-4 py-4">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/8 blur-2xl" />
        <div className="relative flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary">
            <Plug className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-foreground">
              Conecte ferramentas ao seu fluxo
            </div>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
              Agende reuniões, gere salas do Meet e mantenha compromissos alinhados.
            </p>
          </div>
        </div>
      </div>

      {/* Google Calendar */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-surface">
              <CalendarDays className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-[13px] font-semibold text-foreground">
                Google Calendar + Meet
              </div>
              <div className="text-[11.5px] text-muted-foreground">
                Agende reuniões com 1 clique.
              </div>
            </div>
          </div>
          {statusBadge()}
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {[
            {
              icon: CalendarDays,
              title: "Evento no calendário",
              desc: "Sincronizado automaticamente",
            },
            { icon: Video, title: "Link do Meet", desc: "Gerado junto com o evento" },
            { icon: ShieldCheck, title: "Acesso mínimo", desc: "Sua agenda pessoal intocada" },
          ].map((f) => (
            <div
              key={f.title}
              className="flex gap-2 rounded-lg border border-border bg-surface p-2.5"
            >
              <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
                <f.icon className="h-3 w-3" />
              </div>
              <div>
                <div className="text-[12px] font-medium text-foreground">{f.title}</div>
                <div className="text-[11px] text-muted-foreground">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Connection state */}
        <div className="rounded-xl border border-border bg-surface px-4 py-3">
          {isDemoMode ? (
            <div className="flex items-center gap-3">
              <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-[12px] text-muted-foreground">
                Crie uma conta real para conectar.
              </p>
            </div>
          ) : isLoading ? (
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
              <p className="text-[12px] text-muted-foreground">Verificando conexão…</p>
            </div>
          ) : statusQuery.isError ? (
            <div className="flex items-center justify-between">
              <p className="text-[12px] text-destructive">Erro ao verificar integração.</p>
              <Button size="sm" variant="outline" onClick={() => statusQuery.refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : connection ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-full",
                    connection.status === "connected"
                      ? "bg-success/10 text-success"
                      : "bg-destructive/10 text-destructive",
                  )}
                >
                  {connection.status === "connected" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <p className="text-[12px] font-medium text-foreground">
                    {connection.status === "connected" ? "Conta conectada" : "Reconexão necessária"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{connection.account_email}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {connection.status !== "connected" && (
                  <Button size="sm" onClick={connect} disabled={connectMutation.isPending}>
                    Reconectar
                  </Button>
                )}
                <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" disabled={disconnectMutation.isPending}>
                      Desconectar
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Desconectar Google Calendar?</DialogTitle>
                      <DialogDescription>
                        A Prospeca perderá acesso à conta {connection.account_email}.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setDisconnectOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={disconnect} disabled={disconnectMutation.isPending}>
                        {disconnectMutation.isPending ? "Desconectando…" : "Sim, desconectar"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[12px] text-muted-foreground">
                Permissão solicitada somente para criar eventos.
              </p>
              <Button
                size="sm"
                onClick={connect}
                disabled={connectMutation.isPending || !statusQuery.data?.configured}
              >
                {connectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Conectar Google Calendar
              </Button>
            </div>
          )}
        </div>

        {!isDemoMode && statusQuery.data && !statusQuery.data.configured && (
          <div className="flex items-center gap-2 rounded-md bg-warning-soft/60 px-3 py-2">
            <BellRing className="h-3.5 w-3.5 shrink-0 text-warning" />
            <p className="text-[11px] text-warning-foreground">
              Credenciais do Google pendentes neste ambiente.
            </p>
          </div>
        )}
      </div>

      {/* Em breve */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Em breve
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            {
              icon: MessageSquare,
              title: "WhatsApp oficial",
              desc: "Registre conversas no histórico do lead.",
            },
            {
              icon: Webhook,
              title: "Webhooks e automações",
              desc: "Conecte Make, n8n e outros sistemas.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-border bg-surface p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-surface-2">
                  <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <Clock3 className="h-3 w-3" /> Planejado
                </span>
              </div>
              <div className="text-[13px] font-semibold text-foreground mt-2">{item.title}</div>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
