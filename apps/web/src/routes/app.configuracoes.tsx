import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  CheckCircle2,
  Loader2,
  User,
  SlidersHorizontal,
  MessageSquare,
  Gauge,
  Database,
  CreditCard,
  Plug,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  RotateCcw,
  Trash2,
  ArrowRight,
  CalendarDays,
  Video,
  ShieldCheck,
  Webhook,
} from "lucide-react";
import { isDemoMode } from "@/lib/env";
import { getSupabase, invokeFunction } from "@/lib/supabase";
import { SalesContactForm } from "@/components/marketing/SalesContactForm";
import { useUIStore, useSettingsStore, useMessageStore, useLeadsStore } from "@/stores";
import { useSearchSession } from "@/stores/searchSession";
import { clearAllState } from "@/lib/storage";
import { RADIUS_OPTIONS, SORT_OPTIONS, STORAGE_KEY, type SortValue } from "@/lib/constants";
import type { PresenceFilter } from "@/types";
import {
  fetchAccountContext,
  updateFullName,
  updateOrganizationName,
  fetchCurrentSubscription,
} from "@/lib/account";
import { cn } from "@/lib/utils";
import {
  useConnectGoogleCalendar,
  useDisconnectGoogleCalendar,
  useGoogleCalendarStatus,
} from "@/hooks/useGoogleCalendar";

const SECTIONS = [
  { key: "perfil", label: "Perfil", icon: User },
  { key: "geral", label: "Geral", icon: SettingsIcon },
  { key: "prospeccao", label: "Prospecção", icon: SlidersHorizontal },
  { key: "mensagens", label: "Mensagens", icon: MessageSquare },
  { key: "score", label: "Score", icon: Gauge },
  { key: "dados", label: "Dados", icon: Database },
  { key: "plano", label: "Plano", icon: CreditCard },
  { key: "integracoes", label: "Integrações", icon: Plug },
] as const;
type SectionKey = (typeof SECTIONS)[number]["key"];

export const Route = createFileRoute("/app/configuracoes")({
  component: SettingsPage,
});

function readSettingsSearch(): {
  section?: SectionKey;
  integration?: string;
  integrationMessage?: string;
} {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const rawSection = params.get("section");
  return {
    section: SECTIONS.some((item) => item.key === rawSection)
      ? (rawSection as SectionKey)
      : undefined,
    integration: params.get("integration") ?? undefined,
    integrationMessage: params.get("integration_message") ?? undefined,
  };
}

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

function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <p className="text-caption text-muted-foreground">{desc}</p>
    </div>
  );
}

// ── Perfil — a conta real (profiles/organizations), distinta do "nome do
// usuário/empresa" da aba Geral, que é só a assinatura de mensagem local. ──
function PerfilSection() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["account-context"],
    queryFn: fetchAccountContext,
    enabled: !isDemoMode,
  });
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [saving, setSaving] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (data && !loaded.current) {
      setFullName(data.fullName);
      setOrgName(data.organizationName);
      loaded.current = true;
    }
  }, [data]);

  const canEditOrg = data?.role === "owner" || data?.role === "admin";
  const dirty = !!data && (fullName !== data.fullName || orgName !== data.organizationName);

  const save = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const tasks = [updateFullName(fullName)];
      if (canEditOrg && orgName !== data.organizationName) {
        tasks.push(updateOrganizationName(data.organizationId, orgName));
      }
      await Promise.all(tasks);
      toast.success("Perfil atualizado");
      queryClient.invalidateQueries({ queryKey: ["account-context"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar perfil");
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    if (!data) return;
    setFullName(data.fullName);
    setOrgName(data.organizationName);
  };

  if (isDemoMode) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-border bg-surface-2 p-4">
          <p className="text-body font-medium text-foreground">Perfil de demonstração</p>
          <p className="mt-1 text-caption leading-relaxed text-muted-foreground">
            Você está usando dados fictícios. Nome, organização e assinatura podem ser explorados na
            seção Geral sem alterar uma conta real.
          </p>
        </div>
        <Button asChild size="sm">
          <Link to="/cadastro">Criar minha conta gratuita</Link>
        </Button>
      </div>
    );
  }
  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }
  if (!data) {
    return <p className="text-sm text-muted-foreground">Não foi possível carregar sua conta.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="profile-name">Nome completo</Label>
        <Input id="profile-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="profile-email">E-mail</Label>
        <Input id="profile-email" value={data.email ?? ""} disabled />
      </div>
      <div className="space-y-2">
        <Label htmlFor="profile-org">Nome da organização</Label>
        <Input
          id="profile-org"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          disabled={!canEditOrg}
        />
        {!canEditOrg && (
          <p className="text-xs text-muted-foreground">
            Só o dono ou administrador da organização pode renomear.
          </p>
        )}
      </div>

      {dirty && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2">
          <span className="text-caption font-medium text-warning-foreground">
            Alterações não salvas
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={cancel} disabled={saving}>
              Cancelar
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function GeralSection() {
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const density = useUIStore((s) => s.density);
  const setDensity = useUIStore((s) => s.setDensity);
  const settings = useSettingsStore();
  return (
    <div className="space-y-4">
      <Row label="Nome do usuário" desc="Aparece como responsável dos leads.">
        <Input
          placeholder="Seu nome"
          value={settings.userName}
          onChange={(e) => settings.set({ userName: e.target.value })}
          className="w-48"
        />
      </Row>
      <Row label="Nome da empresa" desc="Usado nas mensagens e exportações.">
        <Input
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
    </div>
  );
}

function ProspeccaoSection() {
  const settings = useSettingsStore();
  return (
    <div className="space-y-4">
      <Row label="Limite de seleção em massa" desc="Máximo de leads selecionáveis de uma vez.">
        <Input
          type="number"
          min={1}
          max={50}
          value={settings.bulkLimit}
          onChange={(e) =>
            settings.set({ bulkLimit: Math.max(1, Math.min(50, Number(e.target.value) || 10)) })
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
    </div>
  );
}

function MensagensSection() {
  const settings = useSettingsStore();
  const template = useMessageStore((s) => s.template);
  const setTemplate = useMessageStore((s) => s.setTemplate);
  return (
    <div className="space-y-4">
      <div>
        <div className="text-body-sm font-medium">Modelo padrão do WhatsApp</div>
        <div className="text-micro text-muted-foreground">
          Texto usado ao iniciar uma conversa pelo WhatsApp.
        </div>
        <Textarea
          rows={4}
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          className="mt-2"
        />
      </div>
      <Row label="Nome do remetente" desc="Substitui a variável {{meu_nome}} nas mensagens.">
        <Input
          placeholder="Como você se apresenta"
          value={settings.senderName}
          onChange={(e) => settings.set({ senderName: e.target.value })}
          className="w-48"
        />
      </Row>
      <div>
        <div className="text-body-sm font-medium">Assinatura</div>
        <div className="text-micro text-muted-foreground">
          Anexada ao final das mensagens enviadas.
        </div>
        <Textarea
          rows={2}
          placeholder="Assinatura anexada ao final das mensagens"
          value={settings.signature}
          onChange={(e) => settings.set({ signature: e.target.value })}
          className="mt-2"
        />
      </div>
    </div>
  );
}

// Mesmos critérios/pontos de packages/domain/src/score.ts — mantenha em sincronia.
const SCORE_RULE_VERSION = "v3.0.0";
const SCORE_CRITERIA = [
  { label: "Sem site", points: 30, reason: "Sem presença digital — alta oportunidade" },
  { label: "Reputação fraca (nota < 3,5)", points: 15, reason: "Oportunidade de melhoria" },
  { label: "Pouca tração (< 20 avaliações)", points: 10, reason: "Baixa presença online" },
  { label: "Telefone válido", points: 20, reason: "Contato direto possível" },
  { label: "WhatsApp", points: 12, reason: "Canal de contato rápido" },
  { label: "E-mail comercial", points: 8, reason: "Canal formal disponível" },
  { label: "Instagram", points: 5, reason: "Presença em rede social" },
  { label: "Até 5 km de distância", points: 8, reason: "Muito próximo" },
  { label: "Até 15 km de distância", points: 4, reason: "Próximo" },
  { label: "Categoria identificada", points: 3, reason: "Segmento conhecido" },
];

function ScoreRulesSection() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        O score usa critérios comerciais fixos, não é uma caixa-preta — regra{" "}
        <span className="font-mono">{SCORE_RULE_VERSION}</span>, orientada a oportunidade: score
        alto significa negócio com baixa maturidade digital e alcançável, não necessariamente o
        "melhor" negócio.
      </p>
      <div className="overflow-hidden rounded-lg border border-border">
        {SCORE_CRITERIA.map((c, i) => (
          <div
            key={c.label}
            className={cn(
              "flex items-center justify-between gap-3 px-3 py-2.5 text-sm",
              i > 0 && "border-t border-border",
            )}
          >
            <div>
              <div className="font-medium text-foreground">{c.label}</div>
              <div className="text-xs text-muted-foreground">{c.reason}</div>
            </div>
            <span className="font-mono font-semibold text-primary">+{c.points}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Pesos fixos por enquanto — configuração por organização ainda não existe.
      </p>
    </div>
  );
}

function DadosSection() {
  const resetLeads = useLeadsStore((s) => s.reset);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Same query key as PerfilSection — react-query dedupes/reuses the cached
  // fetch. Deletion is irreversible, so we always pass the organization id
  // explicitly instead of letting the backend guess it (see requireAuth()).
  const { data: account } = useQuery({
    queryKey: ["account-context"],
    queryFn: fetchAccountContext,
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

  const requestAccountDeletion = async () => {
    if (!account) {
      toast.error("Não foi possível confirmar sua organização. Recarregue a página.");
      return;
    }
    setDeleting(true);
    try {
      await invokeFunction("delete-account-data", {
        confirm: "EXCLUIR",
        organizationId: account.organizationId,
      });
      toast.success("Conta excluída. Você será desconectado.");
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
      <div>
        <p className="mb-2 text-caption text-muted-foreground">Backup local deste dispositivo.</p>
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
          {isDemoMode && (
            <Button variant="outline" size="sm" onClick={restoreDemo} className="gap-1.5">
              <RotateCcw className="h-4 w-4" />
              Restaurar demonstração
            </Button>
          )}
        </div>
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
          Limpar dados deste dispositivo
        </Button>
        <p className="mt-1 text-micro text-muted-foreground">
          Remove leads, pipeline e histórico salvos neste navegador — não afeta sua conta.
        </p>
      </div>

      <div className="rounded-lg border border-destructive/30 bg-destructive-soft p-3">
        <p className="text-body-sm font-medium text-destructive">Excluir minha conta</p>
        <p className="mt-0.5 text-micro text-muted-foreground">
          Remove permanentemente seus dados da plataforma. Não afeta só este dispositivo — é a conta
          inteira.
        </p>
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm" className="mt-2">
              Excluir minha conta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Excluir sua conta</DialogTitle>
              <DialogDescription>
                Essa ação não pode ser desfeita. Digite <span className="font-mono">EXCLUIR</span>{" "}
                para confirmar.
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
                {deleting ? "Excluindo..." : "Excluir permanentemente"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function PlanoSection() {
  const { data, isLoading } = useQuery({
    queryKey: ["current-subscription"],
    queryFn: fetchCurrentSubscription,
  });

  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (!data) return <p className="text-sm text-muted-foreground">Nenhum plano encontrado.</p>;

  const limitEntries = Object.entries(data.limits).filter(([k]) => k !== "");

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[17px] font-semibold">{data.planName}</div>
            <Badge variant="secondary" className="mt-1">
              {data.status === "free"
                ? "Gratuito"
                : data.status === "active"
                  ? "Ativo"
                  : data.status}
            </Badge>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/precos">
              Ver planos
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
        {data.currentPeriodEnd && (
          <p className="mt-2 text-xs text-muted-foreground">
            Renova em {new Date(data.currentPeriodEnd).toLocaleDateString("pt-BR")}
            {data.cancelAtPeriodEnd && " — cancelamento agendado"}
          </p>
        )}
      </div>
      {limitEntries.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {limitEntries.map(([key, value]) => (
            <div key={key} className="rounded-lg border border-border bg-surface p-2.5 text-center">
              <div className="text-[15px] font-semibold tabular-nums">
                {value === -1 ? "Ilimitado" : value.toLocaleString("pt-BR")}
              </div>
              <div className="text-[10.5px] text-muted-foreground">{key}</div>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <p className="text-xs text-muted-foreground">Ainda sem checkout automático.</p>
        <SalesContactForm
          source="configuracoes_plano"
          trigger={
            <button className="text-xs font-medium text-primary underline underline-offset-2 hover:text-primary-hover">
              Falar com a gente para migrar de plano
            </button>
          }
        />
      </div>
    </div>
  );
}

function IntegracoesSection() {
  const search = readSettingsSearch();
  const callbackHandled = useRef(false);
  const statusQuery = useGoogleCalendarStatus();
  const connectMutation = useConnectGoogleCalendar();
  const disconnectMutation = useDisconnectGoogleCalendar();
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const connection = statusQuery.data?.connection;

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
    connectMutation.mutate("/app/configuracoes?section=integracoes", {
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

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-primary/20 bg-primary-soft/40 p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Plug className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Conecte ferramentas ao seu fluxo comercial</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Menos copiar e colar: transforme uma oportunidade em compromisso e mantenha o próximo
              passo registrado na Prospeca.
            </p>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-surface-2/60">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border bg-surface">
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm">Google Calendar + Meet</CardTitle>
                <CardDescription className="mt-1 text-xs">
                  Agende reuniões, envie o convite e gere o link do Meet sem sair da oportunidade.
                </CardDescription>
              </div>
            </div>
            {connection?.status === "connected" ? (
              <Badge variant="secondary" className="gap-1 text-success">
                <CheckCircle2 className="h-3 w-3" /> Conectado
              </Badge>
            ) : connection ? (
              <Badge variant="destructive">Reconexão necessária</Badge>
            ) : (
              <Badge variant="outline">Não conectado</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid gap-2 text-xs sm:grid-cols-3">
            <div className="flex items-center gap-2 rounded-lg border p-2.5">
              <CalendarDays className="h-4 w-4 text-primary" /> Evento no calendário
            </div>
            <div className="flex items-center gap-2 rounded-lg border p-2.5">
              <Video className="h-4 w-4 text-primary" /> Link exclusivo do Meet
            </div>
            <div className="flex items-center gap-2 rounded-lg border p-2.5">
              <ShieldCheck className="h-4 w-4 text-primary" /> Acesso mínimo e revogável
            </div>
          </div>

          {isDemoMode ? (
            <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              Entre em uma conta real para conectar seu Google Calendar.
            </p>
          ) : statusQuery.isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Verificando conexão…
            </div>
          ) : statusQuery.isError ? (
            <div className="flex flex-col gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-destructive">
                Não foi possível carregar o estado da integração. Verifique a conexão e tente
                novamente.
              </p>
              <Button size="sm" variant="outline" onClick={() => statusQuery.refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : connection ? (
            <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-medium">
                  {connection.status === "connected"
                    ? "Conta conectada"
                    : connection.status === "reconnect_required"
                      ? "A conta precisa ser reconectada"
                      : "A última sincronização encontrou um erro"}
                </p>
                <p className="text-xs text-muted-foreground">{connection.account_email}</p>
                {connection.last_error && connection.status !== "connected" && (
                  <p className="mt-1 text-[11px] text-destructive">{connection.last_error}</p>
                )}
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
                        A Prospeca perderá acesso à conta {connection.account_email}. Os eventos já
                        criados continuarão no Google Calendar, mas novos Meet não serão gerados.
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
              <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
                A permissão é solicitada somente agora, não durante o cadastro. A Prospeca não
                importa sua agenda completa.
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

          {!isDemoMode && statusQuery.data && !statusQuery.data.configured && (
            <p className="text-[11px] text-warning">
              A interface está pronta, mas as credenciais do Google ainda precisam ser configuradas
              neste ambiente.
            </p>
          )}
        </CardContent>
      </Card>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Próximas conexões
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-dashed p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MessageSquare className="h-4 w-4 text-muted-foreground" /> WhatsApp oficial
              </div>
              <Badge variant="outline">Planejado</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Registrar conversas e resultados no histórico comercial.
            </p>
          </div>
          <div className="rounded-lg border border-dashed p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Webhook className="h-4 w-4 text-muted-foreground" /> Webhooks e automações
              </div>
              <Badge variant="outline">Planejado</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Conectar Make, n8n e outros sistemas sem integrações isoladas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const SECTION_META: Record<SectionKey, { title: string; desc: string }> = {
  perfil: { title: "Perfil", desc: "Sua identidade e a organização." },
  geral: { title: "Geral", desc: "Aparência e identidade de mensagem." },
  prospeccao: { title: "Prospecção", desc: "Padrões usados em novas buscas." },
  mensagens: { title: "Mensagens", desc: "Modelo, remetente e assinatura padrão." },
  score: { title: "Score", desc: "Como cada empresa é priorizada." },
  dados: { title: "Dados", desc: "Backup local e exclusão de conta." },
  plano: { title: "Plano", desc: "Sua assinatura atual." },
  integracoes: {
    title: "Integrações",
    desc: "Conecte ferramentas ao fluxo comercial da Prospeca.",
  },
};

const SECTION_CONTENT: Record<SectionKey, React.ComponentType> = {
  perfil: PerfilSection,
  geral: GeralSection,
  prospeccao: ProspeccaoSection,
  mensagens: MensagensSection,
  score: ScoreRulesSection,
  dados: DadosSection,
  plano: PlanoSection,
  integracoes: IntegracoesSection,
};

function SettingsPage() {
  // null = mobile shows the section list; desktop always shows a section
  // (falls back to "perfil"), it just ignores null.
  const [section, setSection] = useState<SectionKey | null>(null);
  useEffect(() => {
    const linkedSection = readSettingsSearch().section;
    if (linkedSection) setSection(linkedSection);
  }, []);
  const activeKey = section ?? "perfil";
  const meta = SECTION_META[activeKey];
  const Content = SECTION_CONTENT[activeKey];

  return (
    <div className="h-full overflow-y-auto bg-surface-2 p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-4 text-xl font-semibold">Configurações</h1>

        {/* Mobile: list → page */}
        <div className="sm:hidden">
          {section === null ? (
            <div className="space-y-1">
              {SECTIONS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSection(s.key)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface px-3 py-3 text-left hover:bg-surface-hover"
                >
                  <s.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-sm font-medium">{s.label}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          ) : (
            <div>
              <button
                onClick={() => setSection(null)}
                className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
                Configurações
              </button>
              <SectionHeader title={meta.title} desc={meta.desc} />
              <Content />
            </div>
          )}
        </div>

        {/* Desktop: side nav + content */}
        <div className="hidden gap-6 sm:flex">
          <nav className="w-48 shrink-0 space-y-0.5">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors",
                  activeKey === s.key
                    ? "bg-surface text-foreground shadow-card"
                    : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                )}
              >
                <s.icon className="h-4 w-4" />
                {s.label}
              </button>
            ))}
          </nav>
          <div className="min-w-0 flex-1 rounded-xl border border-border bg-surface p-5">
            <SectionHeader title={meta.title} desc={meta.desc} />
            <Content />
          </div>
        </div>
      </div>
    </div>
  );
}
