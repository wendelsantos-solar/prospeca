// Feedback / support form with sentiment, screenshot, email follow-up, and goal context.

import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { invokeFunction, getSupabase } from "@/lib/supabase";
import { isRealMode } from "@/lib/env";
import { getRecentActions } from "@/lib/recent-actions";
import { AppIcon } from "@/design-system/icons/AppIcon";
import { icons } from "@/design-system/icons/icon-registry";
import type { LucideIcon } from "lucide-react";

// --- Constants ---------------------------------------------------------------

type FeedbackType = "feedback" | "bug" | "question" | "feature_request" | "data_quality";
type Sentiment = "frustrated" | "neutral" | "happy";

const FEEDBACK_TYPES: { value: FeedbackType; label: string; icon: LucideIcon }[] = [
  { value: "feedback", label: "Feedback", icon: icons.lead.lightbulb },
  { value: "bug", label: "Reportar problema", icon: icons.feedback.warning },
  { value: "question", label: "Dúvida", icon: icons.feedback.help },
  { value: "feature_request", label: "Sugestão", icon: icons.lead.opportunity },
  { value: "data_quality", label: "Qualidade dos dados", icon: icons.lead.trendingUp },
];

const SENTIMENTS: { value: Sentiment; emoji: string; label: string }[] = [
  { value: "frustrated", emoji: "😤", label: "Frustrado" },
  { value: "neutral", emoji: "😐", label: "Neutro" },
  { value: "happy", emoji: "😊", label: "Satisfeito" },
];

const GOALS: { value: string; label: string }[] = [
  { value: "search_leads", label: "Buscar leads" },
  { value: "review_lead", label: "Analisar um lead" },
  { value: "manage_pipeline", label: "Organizar pipeline" },
  { value: "export_data", label: "Exportar dados" },
  { value: "configure_settings", label: "Configurar conta" },
  { value: "send_message", label: "Enviar mensagem" },
  { value: "analyze_dashboard", label: "Ver painel / analytics" },
  { value: "team_management", label: "Gerenciar equipe" },
  { value: "other", label: "Outro" },
];

const PLACEHOLDERS: Record<FeedbackType, string> = {
  feedback: "Conte o que você está achando do produto...",
  bug: "Descreva o que aconteceu, o que você esperava e como podemos reproduzir o problema.",
  question: "Qual é a sua dúvida? Vamos tentar ajudar.",
  feature_request: "Descreva a funcionalidade que gostaria de ver e como ela te ajudaria.",
  data_quality: "Qual dado está incorreto? Em qual lead/empresa você notou o problema?",
};

const STORAGE_BUCKET = "feedback-attachments";
const SCREENSHOT_MAX_SIZE = 10 * 1024 * 1024; // 10MB

// --- Props -------------------------------------------------------------------

interface FeedbackFormProps {
  trigger?: React.ReactNode;
  currentPage?: string;
  onSuccess?: () => void;
}

// --- Component ---------------------------------------------------------------

export function FeedbackForm({ trigger, currentPage, onSuccess }: FeedbackFormProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("feedback");
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [goal, setGoal] = useState<string>("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [canContact, setCanContact] = useState(false);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset email + canContact when type changes to something that benefits from follow-up
  useEffect(() => {
    if (type === "bug" || type === "data_quality") {
      // Keep email if already set
    }
  }, [type]);

  const resetForm = () => {
    setType("feedback");
    setSentiment(null);
    setGoal("");
    setMessage("");
    setEmail("");
    setCanContact(false);
    setScreenshot(null);
    setScreenshotPreview(null);
  };

  // --- Screenshot handling ---------------------------------------------------

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Apenas imagens são aceitas.");
      return;
    }
    if (file.size > SCREENSHOT_MAX_SIZE) {
      toast.error("Imagem muito grande. Máximo: 10MB.");
      return;
    }

    setScreenshot(file);
    setScreenshotPreview(URL.createObjectURL(file));
  };

  const removeScreenshot = () => {
    if (screenshotPreview) URL.revokeObjectURL(screenshotPreview);
    setScreenshot(null);
    setScreenshotPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadScreenshot = useCallback(async (): Promise<string | null> => {
    if (!screenshot) return null;

    const supabase = getSupabase();
    const ext = screenshot.name.split(".").pop() ?? "png";
    const path = `${crypto.randomUUID()}.${ext}`;

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, screenshot, {
        contentType: screenshot.type,
        upsert: false,
      });

    if (error) {
      console.warn("FeedbackForm: screenshot upload failed", error);
      return null;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(data.path);

    return publicUrl;
  }, [screenshot]);

  // --- Submit ----------------------------------------------------------------

  const handleSubmit = async () => {
    if (!message.trim()) return;

    if (isRealMode) {
      setSubmitting(true);
      try {
        // Upload screenshot first (fire-and-forget if fails)
        let screenshotUrl: string | null = null;
        if (screenshot) {
          setUploading(true);
          screenshotUrl = await uploadScreenshot();
          setUploading(false);
        }

        const response = await invokeFunction<{ success: boolean; message: string }>(
          "submit-feedback",
          {
            type,
            message: message.trim(),
            sentiment: sentiment ?? undefined,
            goal: goal || undefined,
            email: email.trim() || undefined,
            canContact: canContact,
            screenshotUrl: screenshotUrl ?? undefined,
            recentActions: getRecentActions(),
            currentPage: currentPage ?? window.location.pathname,
            appVersion: (import.meta as { env?: Record<string, string> }).env
              ?.VITE_APP_VERSION as string | undefined,
            browser: navigator.userAgent.slice(0, 200),
            operatingSystem: navigator.platform,
          },
        );

        toast.success(response.message);
        resetForm();
        setOpen(false);
        onSuccess?.();
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Erro ao enviar. Tente novamente.";
        toast.error(msg);
      } finally {
        setSubmitting(false);
        setUploading(false);
      }
    } else {
      // Demo mode — simulate success
      toast.success("Feedback registrado (modo demonstração)");
      resetForm();
      setOpen(false);
      onSuccess?.();
    }
  };

  const isLoading = submitting || uploading;

  // --- Derived copy -----------------------------------------------------------

  const isBugOrData = type === "bug" || type === "data_quality";

  // --- Render ----------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <AppIcon
              icon={icons.lead.messageSquare}
              size="sm"
              tone="inherit"
              decorative
            />
            <span className="ml-1.5">Feedback</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar feedback</DialogTitle>
          <DialogDescription>
            Sua opinião ajuda a melhorar o Radar Local.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* ---- Type selector ---- */}
          <div>
            <Label className="mb-1.5 block">Tipo</Label>
            <div className="flex flex-wrap gap-1.5">
              {FEEDBACK_TYPES.map((ft) => (
                <Badge
                  key={ft.value}
                  variant={type === ft.value ? "default" : "secondary"}
                  className="cursor-pointer select-none"
                  onClick={() => setType(ft.value)}
                >
                  <AppIcon icon={ft.icon} size="xs" tone="inherit" decorative />
                  <span className="ml-1">{ft.label}</span>
                </Badge>
              ))}
            </div>
          </div>

          {/* ---- Sentiment ---- */}
          <div>
            <Label className="mb-1.5 block">Como você está se sentindo?</Label>
            <div className="flex gap-3">
              {SENTIMENTS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSentiment(sentiment === s.value ? null : s.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                    sentiment === s.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-muted-foreground/30 text-muted-foreground"
                  }`}
                >
                  <span className="text-lg leading-none">{s.emoji}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ---- Goal (what were you doing?) ---- */}
          <div>
            <Label className="mb-1.5 block">O que você estava tentando fazer?</Label>
            <Select value={goal} onValueChange={setGoal}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione a tarefa..." />
              </SelectTrigger>
              <SelectContent>
                {GOALS.map((g) => (
                  <SelectItem key={g.value} value={g.value}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ---- Message ---- */}
          <div>
            <Label className="mb-1.5 block">
              Mensagem <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={PLACEHOLDERS[type]}
              rows={4}
              maxLength={5000}
              className="resize-none"
            />
            <p className="text-[10px] text-muted-foreground mt-1 text-right">
              {message.length}/5000
            </p>
          </div>

          {/* ---- Screenshot ---- */}
          <div>
            <Label className="mb-1.5 block">Anexar screenshot (opcional)</Label>
            {screenshotPreview ? (
              <div className="relative inline-block group">
                <img
                  src={screenshotPreview}
                  alt="Screenshot preview"
                  className="max-h-32 rounded-lg border border-border object-cover"
                />
                <button
                  type="button"
                  onClick={removeScreenshot}
                  className="absolute -top-2 -right-2 size-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remover imagem"
                >
                  <AppIcon icon={icons.actions.close} size="xs" tone="inherit" decorative />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border hover:border-muted-foreground/40 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <AppIcon icon={icons.system.note} size="sm" tone="inherit" decorative />
                <span>Clique para anexar imagem</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleFileChange}
              className="hidden"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              PNG, JPEG, WebP ou GIF — máx. 10MB
            </p>
          </div>

          {/* ---- Email (follow-up) ---- */}
          {isBugOrData && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="text-xs text-muted-foreground mb-2">
                Para problemas e dados incorretos, recomendamos deixar um e-mail.
                Assim podemos te responder quando resolvermos.
              </p>
              <div className="space-y-2">
                <div>
                  <Label className="mb-1 block text-xs">E-mail para resposta</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="can-contact"
                    checked={canContact}
                    onCheckedChange={(checked) => setCanContact(checked === true)}
                  />
                  <Label htmlFor="can-contact" className="text-xs cursor-pointer font-normal">
                    Autorizo entrar em contato para conversar sobre este feedback
                  </Label>
                </div>
              </div>
            </div>
          )}

          {/* ---- Email (non-bug) ---- */}
          {!isBugOrData && (
            <details className="group">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none">
                Quer uma resposta? Deixe seu e-mail
              </summary>
              <div className="mt-2 space-y-2">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="h-8 text-sm"
                />
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="can-contact-2"
                    checked={canContact}
                    onCheckedChange={(checked) => setCanContact(checked === true)}
                  />
                  <Label htmlFor="can-contact-2" className="text-xs cursor-pointer font-normal">
                    Autorizo entrar em contato para conversar sobre este feedback
                  </Label>
                </div>
              </div>
            </details>
          )}

          {/* ---- Actions ---- */}
          <div className="flex justify-between items-center pt-1">
            <p className="text-[10px] text-muted-foreground">
              Enviado anonimamente para a equipe
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  resetForm();
                  setOpen(false);
                }}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!message.trim() || isLoading}
              >
                {uploading ? "Enviando imagem..." : submitting ? "Enviando..." : "Enviar"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
