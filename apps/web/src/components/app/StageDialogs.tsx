import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useLeadsStore, useSettingsStore } from "@/stores";
import { useLeadDetail } from "@/hooks/useLeadsQuery";
import { getLeadRepository } from "@/repositories";
import type { MoveLeadInput } from "@/repositories/types";
import { DISCARD_REASONS } from "@/lib/constants";
import type { Lead, LeadStage } from "@/types";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const wonSchema = z.object({
  value: z.coerce.number().min(0, "Informe um valor válido"),
  service: z.string().min(1, "Informe o serviço vendido"),
  closedAt: z.string().min(1, "Informe a data"),
  owner: z.string().optional(),
  note: z.string().optional(),
  nextOpportunity: z.string().optional(),
});
type WonForm = z.infer<typeof wonSchema>;

function useStageMutation(onDone: () => void) {
  return useMutation({
    mutationFn: async ({
      lead,
      stage,
      extra,
    }: {
      lead: Lead;
      stage: LeadStage;
      extra?: Partial<Lead>;
    }) => {
      const input: MoveLeadInput = {
        toStage: stage,
        closedValue: extra?.closedValue,
        closedService: extra?.closedService,
        closedAt: extra?.closedAt,
        discardReason: extra?.discardReason,
      };
      return getLeadRepository().moveStage(lead.id, input);
    },
    onSuccess: () => {
      onDone();
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar estágio", {
        description: "O lead não foi movido.",
      });
    },
  });
}

export function WonDialog() {
  const pendingWinId = useLeadsStore((s) => s.pendingWinId);
  const setPendingWin = useLeadsStore((s) => s.setPendingWin);
  const { data: lead } = useLeadDetail(pendingWinId);
  const userName = useSettingsStore((s) => s.userName);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<WonForm>({
    resolver: zodResolver(wonSchema),
    defaultValues: {
      value: 0,
      service: "",
      closedAt: new Date().toISOString().slice(0, 10),
      owner: userName,
      note: "",
      nextOpportunity: "",
    },
  });

  useEffect(() => {
    if (lead) {
      reset({
        value: lead.estimatedValue ?? 0,
        service: "",
        closedAt: new Date().toISOString().slice(0, 10),
        owner: userName,
        note: "",
        nextOpportunity: "",
      });
    }
  }, [lead, reset, userName]);

  const mutation = useStageMutation(() => {
    toast.success("Negócio marcado como ganho");
    setPendingWin(null);
  });

  const onSubmit = (data: WonForm) => {
    if (!lead) return;
    mutation.mutate({
      lead,
      stage: "won",
      extra: {
        closedValue: data.value,
        closedService: data.service,
        closedAt: new Date(`${data.closedAt}T12:00:00`).toISOString(),
      },
    });
  };

  return (
    <Dialog open={!!pendingWinId} onOpenChange={(v) => !v && setPendingWin(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar negócio ganho — {lead?.companyName}</DialogTitle>
          <DialogDescription>Preencha os dados do negócio fechado.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="won-value">Valor fechado (R$)</Label>
              <Input id="won-value" type="number" step="0.01" {...register("value")} />
              {errors.value && (
                <p className="mt-1 text-xs text-destructive">{errors.value.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="won-date">Data do fechamento</Label>
              <Input id="won-date" type="date" {...register("closedAt")} />
              {errors.closedAt && (
                <p className="mt-1 text-xs text-destructive">{errors.closedAt.message}</p>
              )}
            </div>
          </div>
          <div>
            <Label htmlFor="won-service">Serviço vendido</Label>
            <Input id="won-service" placeholder="Ex.: Criação de site" {...register("service")} />
            {errors.service && (
              <p className="mt-1 text-xs text-destructive">{errors.service.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="won-owner">Responsável</Label>
            <Input id="won-owner" placeholder="Quem fechou o negócio" {...register("owner")} />
          </div>
          <div>
            <Label htmlFor="won-note">Observação</Label>
            <Textarea id="won-note" rows={2} {...register("note")} />
          </div>
          <div>
            <Label htmlFor="won-next">Próxima oportunidade (opcional)</Label>
            <Input
              id="won-next"
              placeholder="Ex.: Upsell de tráfego pago em 3 meses"
              {...register("nextOpportunity")}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setPendingWin(null)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="gap-1.5">
              {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Confirmar ganho
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DiscardDialog() {
  const pendingDiscardId = useLeadsStore((s) => s.pendingDiscardId);
  const setPendingDiscard = useLeadsStore((s) => s.setPendingDiscard);
  const { data: lead } = useLeadDetail(pendingDiscardId);
  const [reason, setReason] = useState<string>(DISCARD_REASONS[0]);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (pendingDiscardId) {
      setReason(DISCARD_REASONS[0]);
      setNote("");
    }
  }, [pendingDiscardId]);

  const mutation = useStageMutation(() => {
    toast.success("Lead descartado");
    setPendingDiscard(null);
  });

  return (
    <Dialog open={!!pendingDiscardId} onOpenChange={(v) => !v && setPendingDiscard(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Descartar lead — {lead?.companyName}</DialogTitle>
          <DialogDescription>Informe o motivo do descarte.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Motivo</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DISCARD_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="discard-note">Observação (opcional)</Label>
            <Textarea id="discard-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setPendingDiscard(null)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={mutation.isPending}
            className="gap-1.5"
            onClick={() =>
              lead &&
              mutation.mutate({ lead, stage: "discarded", extra: { discardReason: reason } })
            }
          >
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Descartar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
