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
  XCircle,
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
} from "lucide-react";
import { integrationStatuses, isRealMode, isDemoMode } from "@/lib/env";
import { invokeFunction, supabaseAvailable, getSupabase } from "@/lib/supabase";
import { UsageCostCard } from "@/components/app/UsageCostCard";
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

export const Route = createFileRoute("/app/configuracoes")({
  component: SettingsPage,
});

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

interface TestResult {
  name: string;
  ok: boolean;
  latencyMs: number;
  message: string;
}

function IntegracoesSection() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const statuses = integrationStatuses();

  async function runTests() {
    if (!supabaseAvailable()) {
      toast.error("Supabase não configurado — testes indisponíveis em modo demo.");
      return;
    }
    setTesting(true);
    const out: TestResult[] = [];

    const t0 = performance.now();
    try {
      const { error } = await getSupabase().from("organization_members").select("id").limit(1);
      out.push({
        name: "Banco de dados (RLS)",
        ok: !error,
        latencyMs: Math.round(performance.now() - t0),
        message: error ? "Falha na consulta" : "Conectado",
      });
    } catch {
      out.push({
        name: "Banco de dados (RLS)",
        ok: false,
        latencyMs: Math.round(performance.now() - t0),
        message: "Sem conexão",
      });
    }

    const t1 = performance.now();
    try {
      await invokeFunction("geocode-location", { query: "São Paulo, SP" });
      out.push({
        name: "Geocodificação (Edge Function)",
        ok: true,
        latencyMs: Math.round(performance.now() - t1),
        message: "OK",
      });
    } catch (err) {
      out.push({
        name: "Geocodificação (Edge Function)",
        ok: false,
        latencyMs: Math.round(performance.now() - t1),
        message: err instanceof Error ? err.message : "Falha",
      });
    }

    setResults(out);
    setTesting(false);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status das integrações</CardTitle>
          <CardDescription>Configuração detectada no ambiente atual.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {statuses.map((s) => (
            <div key={s.name} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {s.configured ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                <span className="text-sm font-medium">{s.name}</span>
              </div>
              <Badge variant={s.configured ? "secondary" : "destructive"}>{s.detail}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <UsageCostCard />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Testar conexões</CardTitle>
          <CardDescription>
            Executa verificações reais (banco e geocodificação de teste).
            {!isRealMode && " Disponível apenas em modo real."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={runTests} disabled={testing || !isRealMode}>
            {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Testar conexão
          </Button>
          {results.map((r) => (
            <div key={r.name} className="flex items-center justify-between gap-4 text-sm">
              <div className="flex items-center gap-2">
                {r.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                {r.name}
              </div>
              <span className="text-muted-foreground">
                {r.message} · {r.latencyMs}ms
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
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
  integracoes: { title: "Integrações", desc: "Status das integrações externas." },
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
