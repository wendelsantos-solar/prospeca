import { type ReactNode, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { invokeFunction } from "@/lib/supabase";
import { readUtm } from "@/lib/utm";
import { track } from "@/lib/analytics";
import { Check } from "lucide-react";

const schema = z.object({
  name: z.string().min(2, "Informe seu nome"),
  email: z.string().email("E-mail inválido"),
  company: z.string().optional(),
  teamSize: z.string().optional(),
  sellsWhat: z.string().optional(),
  prospectingVolume: z.string().optional(),
  whatsapp: z.string().optional(),
  message: z.string().min(5, "Conte um pouco mais"),
  // honeypot — hidden from real users via CSS, bots fill every field they see
  website: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export function SalesContactForm({ trigger, source }: { trigger: ReactNode; source: string }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (data) => {
    try {
      await invokeFunction("submit-sales-contact", {
        ...data,
        source,
        utm: readUtm() ?? undefined,
      });
      track("sales_contact_completed", { source });
      setSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar. Tente novamente.");
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          track("sales_contact_started", { source });
          reset();
          setSent(false);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {sent ? (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-primary-soft">
              <Check className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle>Mensagem enviada</DialogTitle>
            <DialogDescription className="mt-1">
              Recebemos seu contato e vamos te responder em breve.
            </DialogDescription>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Falar com vendas</DialogTitle>
              <DialogDescription>
                Conte um pouco sobre sua operação — respondemos por e-mail.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="absolute -left-[9999px]" aria-hidden="true" tabIndex={-1}>
                <label htmlFor="website">Site</label>
                <input id="website" tabIndex={-1} autoComplete="off" {...register("website")} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nome</Label>
                  <Input id="name" {...register("name")} />
                  {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-mail profissional</Label>
                  <Input id="email" type="email" {...register("email")} />
                  {errors.email && (
                    <p className="text-xs text-destructive">{errors.email.message}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="company">Empresa</Label>
                  <Input id="company" {...register("company")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="teamSize">Tamanho da equipe</Label>
                  <Input id="teamSize" placeholder="ex: só eu, 2-5, 6+" {...register("teamSize")} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="sellsWhat">O que você vende</Label>
                  <Input
                    id="sellsWhat"
                    placeholder="ex: sites, tráfego pago"
                    {...register("sellsWhat")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prospectingVolume">Volume de prospecção</Label>
                  <Input
                    id="prospectingVolume"
                    placeholder="ex: 20 empresas/semana"
                    {...register("prospectingVolume")}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="whatsapp">WhatsApp (opcional)</Label>
                <Input id="whatsapp" {...register("whatsapp")} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="message">Mensagem</Label>
                <Textarea id="message" rows={3} {...register("message")} />
                {errors.message && (
                  <p className="text-xs text-destructive">{errors.message.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Enviando..." : "Enviar"}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
