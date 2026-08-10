import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Building2, UserCircle, Sun, Moon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { isDemoMode } from "@/lib/env";
import { fetchAccountContext, updateFullName, updateOrganizationName } from "@/lib/account";
import { useUIStore, useSettingsStore } from "@/stores";
import { cn } from "@/lib/utils";
import { AppIcon } from "@/design-system/icons/AppIcon";
import { icons } from "@/design-system/icons/icon-registry";

function ProfileSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Carregando perfil">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg border border-border bg-surface" />
      ))}
    </div>
  );
}

export function AccountSettings() {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["account-context"],
    queryFn: fetchAccountContext,
    enabled: !isDemoMode,
  });

  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const density = useUIStore((s) => s.density);
  const setDensity = useUIStore((s) => s.setDensity);
  const settings = useSettingsStore();

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
      toast.error(err instanceof Error ? err.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    if (!data) return;
    setFullName(data.fullName);
    setOrgName(data.organizationName);
  };

  return (
    <div className="space-y-6">
      {/* ── Perfil & Organização ── */}
      {isDemoMode ? (
        <div className="rounded-xl border border-border bg-surface px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
              <UserCircle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-foreground">Perfil de demonstração</p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                Dados fictícios. Crie uma conta gratuita para personalizar.
              </p>
              <Button asChild size="sm" className="mt-3">
                <Link to="/cadastro">Criar minha conta gratuita</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : isLoading ? (
        <ProfileSkeleton />
      ) : error ? (
        <div className="grid h-full place-items-center">
          <div className="flex flex-col items-center gap-3 py-10 px-6 text-center" role="alert">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
              <AppIcon icon={icons.feedback.warning} size="xl" tone="inherit" decorative />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Não foi possível carregar sua conta
              </p>
              <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                Verifique sua conexão e tente novamente.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        </div>
      ) : data ? (
        <div className="space-y-4">
          <div>
            <div className="text-[13px] font-semibold text-foreground">Perfil & organização</div>
            <div className="text-[11.5px] text-muted-foreground">
              Dados vinculados à sua assinatura.
            </div>
          </div>

          <div className="divide-y divide-border rounded-xl border border-border bg-surface">
            <div className="space-y-1.5 px-4 py-3">
              <Label htmlFor="profile-name" className="text-[12px]">
                Nome completo
              </Label>
              <Input
                id="profile-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5 px-4 py-3">
              <Label htmlFor="profile-email" className="text-[12px]">
                E-mail
              </Label>
              <div className="relative">
                <Input id="profile-email" value={data.email ?? ""} disabled className="h-9 pr-9" />
                <Mail className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-1.5 px-4 py-3">
              <Label htmlFor="profile-org" className="text-[12px]">
                Organização
              </Label>
              <div className="relative">
                <Input
                  id="profile-org"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  disabled={!canEditOrg}
                  className="h-9 pr-9"
                />
                <Building2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
              {!canEditOrg && (
                <p className="text-[11px] text-muted-foreground">
                  Só o dono ou administrador pode renomear.
                </p>
              )}
            </div>
          </div>

          {dirty && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-2.5">
              <span className="text-[12px] font-medium text-muted-foreground">
                Alterações não salvas
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={cancel} disabled={saving}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={save} disabled={saving}>
                  {saving ? "Salvando…" : "Salvar"}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* ── Identidade comercial ── */}
      <div className="space-y-4">
        <div>
          <div className="text-[13px] font-semibold text-foreground">Identidade comercial</div>
          <div className="text-[11.5px] text-muted-foreground">
            Como você aparece para leads e relatórios.
          </div>
        </div>
        <div className="divide-y divide-border rounded-xl border border-border bg-surface">
          <div className="space-y-1.5 px-4 py-3">
            <Label htmlFor="geral-name" className="text-[12px]">
              Nome de exibição
            </Label>
            <Input
              id="geral-name"
              placeholder="Seu nome"
              value={settings.userName}
              onChange={(e) => settings.set({ userName: e.target.value })}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5 px-4 py-3">
            <Label htmlFor="geral-company" className="text-[12px]">
              Empresa
            </Label>
            <Input
              id="geral-company"
              placeholder="Sua empresa"
              value={settings.companyName}
              onChange={(e) => settings.set({ companyName: e.target.value })}
              className="h-9"
            />
          </div>
        </div>
      </div>

      {/* ── Aparência ── */}
      <div className="space-y-4">
        <div>
          <div className="text-[13px] font-semibold text-foreground">Aparência</div>
          <div className="text-[11.5px] text-muted-foreground">Personalize a interface.</div>
        </div>
        <div className="divide-y divide-border rounded-xl border border-border bg-surface">
          <div className="flex items-center justify-between gap-4 px-4 py-3">
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
                <Sun className="h-3.5 w-3.5" /> Claro
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
                <Moon className="h-3.5 w-3.5" /> Escuro
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div>
              <div className="text-[13px] font-medium text-foreground">Densidade</div>
              <div className="text-[11.5px] text-muted-foreground">
                Compactação da lista de leads.
              </div>
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
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div>
              <div className="text-[13px] font-medium text-foreground">Moeda</div>
              <div className="text-[11.5px] text-muted-foreground">
                Outras moedas em versões futuras.
              </div>
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
      </div>
    </div>
  );
}
