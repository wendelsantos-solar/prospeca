import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
  BellRing,
  ArrowUpRight,
  Clock3,
  X,
  Sun,
  Moon,
  AlertTriangle,
  Mail,
  Building2,
  UserCircle,
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

// ── Shared primitives ──

function SettingRow({
  label,
  desc,
  children,
}: {
  label: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface-2/50 px-4 py-3">
      <div>
        <div className="text-[13px] font-medium text-foreground">{label}</div>
        <div className="text-[11.5px] text-muted-foreground">{desc}</div>
      </div>
      {children}
    </div>
  );
}

function SettingCard({
  title,
  desc,
  children,
  className,
}: {
  title?: string;
  desc?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-surface shadow-card", className)}>
      {(title || desc) && (
        <div className="border-b border-border bg-surface-2/50 px-5 py-4">
          {title && <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>}
          {desc && <p className="mt-0.5 text-[12px] text-muted-foreground">{desc}</p>}
        </div>
      )}
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
      <p className="mt-0.5 text-[13px] text-muted-foreground">{desc}</p>
    </div>
  );
}

// ── Section skeletons ──

function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface-2/50 px-4 py-3">
          <div>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-1 h-3 w-48" />
          </div>
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

function ProfileSectionSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando perfil">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
  );
}

function PlanoSectionSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando plano">
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-2 h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ── Perfil ──

function PerfilSection() {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
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
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-surface-2/60 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
              <UserCircle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-foreground">Perfil de demonstração</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                Você está usando dados fictícios. Nome, organização e assinatura podem ser
                explorados na seção Geral sem alterar uma conta real.
              </p>
            </div>
          </div>
        </div>
        <Button asChild size="sm">
          <Link to="/cadastro">Criar minha conta gratuita</Link>
        </Button>
      </div>
    );
  }

  if (isLoading) return <ProfileSectionSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Não foi possível carregar sua conta</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Verifique sua conexão e tente novamente.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <UserCircle className="h-5 w-5" />
        </div>
        <p className="text-sm text-muted-foreground">Nenhum dado de conta encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SettingCard title="Identidade" desc="Seus dados pessoais e da organização.">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-name" className="text-[12px]">Nome completo</Label>
            <Input
              id="profile-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-email" className="text-[12px]">E-mail</Label>
            <div className="relative">
              <Input id="profile-email" value={data.email ?? ""} disabled className="h-10 pr-9" />
              <Mail className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-org" className="text-[12px]">Nome da organização</Label>
            <div className="relative">
              <Input
                id="profile-org"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                disabled={!canEditOrg}
                className="h-10 pr-9"
              />
              <Building2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            {!canEditOrg && (
              <p className="text-[11px] text-muted-foreground">
                Só o dono ou administrador da organização pode renomear.
              </p>
            )}
          </div>
        </div>
      </SettingCard>

      {dirty && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
            <span className="text-[13px] font-medium text-warning-foreground">
              Alterações não salvas
            </span>
          </div>
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

// ── Geral ──

function GeralSection() {
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const density = useUIStore((s) => s.density);
  const setDensity = useUIStore((s) => s.setDensity);
  const settings = useSettingsStore();

  return (
    <div className="space-y-5">
      <SettingCard title="Identidade de mensagem" desc="Como você aparece nas comunicações.">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="geral-name" className="text-[12px]">Nome do usuário</Label>
            <Input
              id="geral-name"
              placeholder="Seu nome"
              value={settings.userName}
              onChange={(e) => settings.set({ userName: e.target.value })}
              className="h-10"
            />
            <p className="text-[11px] text-muted-foreground">
              Aparece como responsável pelos leads.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="geral-company" className="text-[12px]">Nome da empresa</Label>
            <Input
              id="geral-company"
              placeholder="Sua empresa"
              value={settings.companyName}
              onChange={(e) => settings.set({ companyName: e.target.value })}
              className="h-10"
            />
            <p className="text-[11px] text-muted-foreground">
              Usado nas mensagens e exportações.
            </p>
          </div>
        </div>
      </SettingCard>

      <SettingCard title="Aparência" desc="Personalize a interface.">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[13px] font-medium text-foreground">Tema</div>
              <div className="text-[11.5px] text-muted-foreground">Claro ou escuro.</div>
            </div>
            <div className="flex rounded-lg border border-border bg-surface-2 p-0.5">
              <button
                onClick={() => theme !== "light" && toggleTheme()}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-all",
                  theme === "light"
                    ? "bg-surface text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Sun className="h-3.5 w-3.5" />
                Claro
              </button>
              <button
                onClick={() => theme !== "dark" && toggleTheme()}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-all",
                  theme === "dark"
                    ? "bg-surface text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Moon className="h-3.5 w-3.5" />
                Escuro
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[13px] font-medium text-foreground">Densidade</div>
              <div className="text-[11.5px] text-muted-foreground">Compactação da lista de leads.</div>
            </div>
            <div className="flex rounded-lg border border-border bg-surface-2 p-0.5">
              {(["compact", "comfortable"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDensity(d)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-[12px] font-medium transition-all",
                    density === d
                      ? "bg-surface text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {d === "compact" ? "Compacto" : "Confortável"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[13px] font-medium text-foreground">Formato de moeda</div>
              <div className="text-[11.5px] text-muted-foreground">Outras moedas em versões futuras.</div>
            </div>
            <Select value="BRL" disabled>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BRL">Real brasileiro (R$)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SettingCard>
    </div>
  );
}

// ── Prospecção ──

function ProspeccaoSection() {
  const settings = useSettingsStore();
  return (
    <SettingCard
      title="Padrões de busca"
      desc="Valores iniciais aplicados ao abrir uma nova prospecção."
    >
      <div className="space-y-4">
        <SettingRow label="Limite de seleção em massa" desc="Máximo de leads selecionáveis de uma vez.">
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
        </SettingRow>
        <SettingRow label="Filtro de presença digital" desc="Aplicado ao abrir uma nova busca.">
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
        </SettingRow>
        <SettingRow label="Raio padrão" desc="Distância inicial da busca no mapa.">
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
        </SettingRow>
        <SettingRow label="Ordenação padrão" desc="Ordem inicial dos resultados de busca.">
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
        </SettingRow>
      </div>
    </SettingCard>
  );
}

// ── Mensagens ──

function MensagensSection() {
  const settings = useSettingsStore();
  const template = useMessageStore((s) => s.template);
  const setTemplate = useMessageStore((s) => s.setTemplate);
  return (
    <div className="space-y-5">
      <SettingCard title="Modelo padrão do WhatsApp" desc="Texto usado ao iniciar uma conversa.">
        <Textarea
          rows={4}
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          className="resize-none"
          placeholder="Olá {{nome_do_lead}}, tudo bem? Meu nome é {{meu_nome}}..."
        />
        <p className="mt-2 text-[11px] text-muted-foreground">
          Use <code className="rounded bg-muted px-1 py-0.5 text-[10px]">{`{{nome_do_lead}}`}</code>{" "}
          e <code className="rounded bg-muted px-1 py-0.5 text-[10px]">{`{{meu_nome}}`}</code>{" "}
          como variáveis.
        </p>
      </SettingCard>

      <SettingCard title="Remetente e assinatura" desc="Identidade das suas mensagens.">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="msg-sender" className="text-[12px]">Nome do remetente</Label>
            <Input
              id="msg-sender"
              placeholder="Como você se apresenta"
              value={settings.senderName}
              onChange={(e) => settings.set({ senderName: e.target.value })}
              className="h-10"
            />
            <p className="text-[11px] text-muted-foreground">
              Substitui a variável <code className="rounded bg-muted px-1 py-0.5 text-[10px]">{`{{meu_nome}}`}</code>.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="msg-signature" className="text-[12px]">Assinatura</Label>
            <Textarea
              id="msg-signature"
              rows={2}
              placeholder="Assinatura anexada ao final das mensagens"
              value={settings.signature}
              onChange={(e) => settings.set({ signature: e.target.value })}
              className="resize-none"
            />
            <p className="text-[11px] text-muted-foreground">
              Anexada ao final de cada mensagem enviada.
            </p>
          </div>
        </div>
      </SettingCard>
    </div>
  );
}

// ── Score ──
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
const MAX_SCORE = SCORE_CRITERIA.reduce((s, c) => s + c.points, 0);

function ScoreRulesSection() {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-surface-2/60 px-5 py-4">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          O score usa critérios comerciais fixos — regra{" "}
          <span className="font-mono text-foreground">{SCORE_RULE_VERSION}</span>. Score alto
          significa negócio com baixa maturidade digital e alcançável, não necessariamente o
          "melhor" negócio.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
        <div className="border-b border-border bg-surface-2/50 px-5 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-semibold text-foreground">Critérios de pontuação</h3>
              <p className="text-[11px] text-muted-foreground">
                Total máximo: {MAX_SCORE} pontos
              </p>
            </div>
          </div>
        </div>
        <div className="divide-y divide-border">
          {SCORE_CRITERIA.map((c) => {
            const pct = (c.points / MAX_SCORE) * 100;
            return (
              <div
                key={c.label}
                className="flex items-center justify-between gap-4 px-5 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-foreground">{c.label}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary/30"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground">{c.reason}</span>
                  </div>
                </div>
                <span className="shrink-0 text-[13px] font-semibold tabular-nums text-primary">
                  +{c.points}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Pesos fixos por enquanto — configuração por organização ainda não existe.
      </p>
    </div>
  );
}

// ── Dados ──

function DadosSection() {
  const resetLeads = useLeadsStore((s) => s.reset);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
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
    <div className="space-y-5">
      <SettingCard title="Backup local" desc="Exporte ou importe dados deste dispositivo.">
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
      </SettingCard>

      <SettingCard title="Limpeza local" desc="Remove dados salvos neste navegador.">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            clearAllState();
            toast.success("Dados limpos. Recarregue a página.");
          }}
        >
          <Trash2 className="mr-1.5 h-4 w-4" />
          Limpar dados deste dispositivo
        </Button>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Remove leads, pipeline e histórico salvos neste navegador — não afeta sua conta.
        </p>
      </SettingCard>

      <div className="rounded-xl border border-destructive/30 bg-destructive-soft/40 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-destructive">Excluir minha conta</h3>
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
                    {deleting ? "Excluindo..." : "Excluir permanentemente"}
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

// ── Plano ──

function PlanoSection() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["current-subscription"],
    queryFn: fetchCurrentSubscription,
  });

  if (isLoading) return <PlanoSectionSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Não foi possível carregar o plano</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Verifique sua conexão e tente novamente.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <CreditCard className="h-5 w-5" />
        </div>
        <p className="text-sm text-muted-foreground">Nenhum plano encontrado.</p>
      </div>
    );
  }

  const limitEntries = Object.entries(data.limits).filter(([k]) => k !== "");

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
        <div className="flex items-center justify-between gap-4 border-b border-border bg-surface-2/50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-foreground">{data.planName}</h3>
              <div className="mt-1">
                <Badge variant="secondary" className="text-[10px]">
                  {data.status === "free"
                    ? "Gratuito"
                    : data.status === "active"
                      ? "Ativo"
                      : data.status}
                </Badge>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/precos">
              Ver planos
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
        <div className="px-5 py-4">
          {data.currentPeriodEnd && (
            <p className="mb-3 text-[12px] text-muted-foreground">
              Renova em {new Date(data.currentPeriodEnd).toLocaleDateString("pt-BR")}
              {data.cancelAtPeriodEnd && " — cancelamento agendado"}
            </p>
          )}
          {limitEntries.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {limitEntries.map(([key, value]) => (
                <div
                  key={key}
                  className="rounded-lg border border-border bg-surface-2/60 p-3 text-center"
                >
                  <div className="text-[16px] font-semibold tabular-nums text-foreground">
                    {value === -1 ? "∞" : value.toLocaleString("pt-BR")}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{key}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 px-1">
        <p className="text-[11px] text-muted-foreground">Ainda sem checkout automático.</p>
        <SalesContactForm
          source="configuracoes_plano"
          trigger={
            <button className="text-[11px] font-medium text-primary underline underline-offset-2 hover:text-primary-hover">
              Falar com a gente para migrar de plano
            </button>
          }
        />
      </div>
    </div>
  );
}

// ── Integrações ──

function IntegracoesSection() {
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

  const renderStatusBadge = () => {
    if (isDemoMode) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          Demonstração
        </span>
      );
    }
    if (isLoading) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Verificando
        </span>
      );
    }
    if (statusQuery.isError) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive">
          <AlertTriangle className="h-3 w-3" /> Erro
        </span>
      );
    }
    if (connection?.status === "connected") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">
          <CheckCircle2 className="h-3 w-3" /> Conectado
        </span>
      );
    }
    if (connection) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive">
          <X className="h-3 w-3" /> Reconexão necessária
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
        Não conectado
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* ── Hero banner ── */}
      <div className="relative overflow-hidden rounded-xl border border-primary/15 bg-gradient-to-br from-primary-soft/60 via-primary-subtle/40 to-surface px-5 py-4">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/8 blur-2xl" />
        <div className="relative flex items-start gap-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary shadow-sm">
            <Plug className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-foreground">
              Conecte ferramentas ao seu fluxo comercial
            </h3>
            <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
              Menos copiar e colar: transforme uma oportunidade em compromisso e mantenha o
              próximo passo registrado na Prospeca.
            </p>
          </div>
        </div>
      </div>

      {/* ── Google Calendar + Meet ── */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border bg-surface-2/50 px-5 py-4">
          <div className="flex items-start gap-3.5">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-surface shadow-sm">
              <CalendarDays className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="text-[14px] font-semibold text-foreground">Google Calendar + Meet</h4>
              <p className="mt-0.5 max-w-lg text-[12px] leading-relaxed text-muted-foreground">
                Agende reuniões, envie o convite e gere o link do Meet sem sair da oportunidade.
              </p>
            </div>
          </div>
          <div className="shrink-0">{renderStatusBadge()}</div>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-4">
          {/* Feature list with descriptions */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex gap-2.5 rounded-lg border border-border bg-surface-2/40 p-3">
              <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
                <CalendarDays className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className="text-[12px] font-medium text-foreground">Evento no calendário</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  Data, horário e contato organizados automaticamente.
                </p>
              </div>
            </div>
            <div className="flex gap-2.5 rounded-lg border border-border bg-surface-2/40 p-3">
              <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
                <Video className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className="text-[12px] font-medium text-foreground">Link exclusivo do Meet</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  Sala de reunião gerada junto com o evento.
                </p>
              </div>
            </div>
            <div className="flex gap-2.5 rounded-lg border border-border bg-surface-2/40 p-3">
              <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
                <ShieldCheck className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className="text-[12px] font-medium text-foreground">Acesso mínimo e revogável</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  Sua agenda pessoal não é importada.
                </p>
              </div>
            </div>
          </div>

          {/* Connection state */}
          {isDemoMode ? (
            <div className="flex items-center gap-3 rounded-lg bg-muted/60 px-4 py-3">
              <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-[12px] text-muted-foreground">
                Entre em uma conta real para conectar seu Google Calendar.
              </p>
            </div>
          ) : isLoading ? (
            <div className="flex items-center gap-3 rounded-lg bg-muted/60 px-4 py-3">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
              <p className="text-[12px] text-muted-foreground">Verificando conexão…</p>
            </div>
          ) : statusQuery.isError ? (
            <div className="flex flex-col gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[12px] text-destructive">
                Não foi possível carregar o estado da integração. Verifique a conexão e tente
                novamente.
              </p>
              <Button size="sm" variant="outline" onClick={() => statusQuery.refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : connection ? (
            <div className="rounded-lg border border-border bg-surface-2/40 px-4 py-3">
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
                      {connection.status === "connected"
                        ? "Conta conectada"
                        : connection.status === "reconnect_required"
                          ? "A conta precisa ser reconectada"
                          : "A última sincronização encontrou um erro"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {connection.account_email}
                    </p>
                    {connection.last_error && connection.status !== "connected" && (
                      <p className="mt-0.5 text-[11px] text-destructive">
                        {connection.last_error}
                      </p>
                    )}
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
                          A Prospeca perderá acesso à conta {connection.account_email}. Os eventos
                          já criados continuarão no Google Calendar, mas novos Meet não serão
                          gerados.
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
            </div>
          ) : (
            <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface-2/40 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" />
                </div>
                <p className="max-w-md text-[12px] leading-relaxed text-muted-foreground">
                  A permissão é solicitada somente agora, não durante o cadastro. A Prospeca não
                  importa sua agenda completa — apenas cria os eventos que você decidir agendar.
                </p>
              </div>
              <Button
                size="sm"
                onClick={connect}
                disabled={connectMutation.isPending || !statusQuery.data?.configured}
                className="shrink-0"
              >
                {connectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Conectar Google Calendar
              </Button>
            </div>
          )}

          {!isDemoMode && statusQuery.data && !statusQuery.data.configured && (
            <div className="flex items-center gap-2 rounded-md bg-warning-soft/60 px-3 py-2">
              <BellRing className="h-3.5 w-3.5 shrink-0 text-warning" />
              <p className="text-[11px] text-warning-foreground">
                A interface está pronta, mas as credenciais do Google ainda precisam ser
                configuradas neste ambiente.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Próximas conexões ── */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Em breve
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="group relative overflow-hidden rounded-xl border border-border bg-surface p-4 transition-shadow hover:shadow-card">
            <div className="absolute inset-0 bg-gradient-to-br from-muted/0 to-muted/30 opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative">
              <div className="flex items-start justify-between gap-2">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-surface-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <Clock3 className="h-3 w-3" /> Planejado
                </span>
              </div>
              <h4 className="mt-3 text-[13px] font-semibold text-foreground">
                WhatsApp oficial
              </h4>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                Registre conversas e resultados de WhatsApp direto no histórico comercial do lead.
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/60">
                <span>Disponível em breve</span>
                <ArrowUpRight className="h-3 w-3" />
              </div>
            </div>
          </div>
          <div className="group relative overflow-hidden rounded-xl border border-border bg-surface p-4 transition-shadow hover:shadow-card">
            <div className="absolute inset-0 bg-gradient-to-br from-muted/0 to-muted/30 opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative">
              <div className="flex items-start justify-between gap-2">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-surface-2">
                  <Webhook className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <Clock3 className="h-3 w-3" /> Planejado
                </span>
              </div>
              <h4 className="mt-3 text-[13px] font-semibold text-foreground">
                Webhooks e automações
              </h4>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                Conecte Make, n8n e outros sistemas sem integrações ponto a ponto.
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/60">
                <span>Disponível em breve</span>
                <ArrowUpRight className="h-3 w-3" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Section registry ──

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

// ── Settings Page ──

function SettingsPage() {
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
        <h1 className="mb-5 text-[22px] font-semibold tracking-tight text-foreground">
          Configurações
        </h1>

        {/* Mobile: list → page */}
        <div className="sm:hidden">
          {section === null ? (
            <div className="space-y-1">
              {SECTIONS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSection(s.key)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3.5 text-left transition-colors hover:bg-surface-hover active:scale-[0.99]"
                >
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted-foreground">
                    <s.icon className="h-4 w-4" />
                  </div>
                  <span className="flex-1 text-[14px] font-medium text-foreground">
                    {s.label}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          ) : (
            <div>
              <button
                onClick={() => setSection(null)}
                className="mb-4 flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground"
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
            {SECTIONS.map((s) => {
              const active = activeKey === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setSection(s.key)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-all",
                    active
                      ? "bg-surface text-foreground shadow-card"
                      : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                  )}
                >
                  <s.icon
                    className={cn(
                      "h-4 w-4 transition-colors",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  {s.label}
                </button>
              );
            })}
          </nav>
          <div className="min-w-0 flex-1 rounded-xl border border-border bg-surface p-5 shadow-card">
            <SectionHeader title={meta.title} desc={meta.desc} />
            <Content />
          </div>
        </div>
      </div>
    </div>
  );
}
