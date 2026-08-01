// submit-sales-contact: public, unauthenticated — the landing page's "Falar
// com vendas" form. No requireAuth() (there's no user yet). Protected by a
// honeypot field + a 60s per-email cooldown instead — not robust anti-abuse,
// good enough for Fase 1 (see docs/MARKETING_SITE.md).
import { z } from "npm:zod@3";
import { AppError, handleOptions, json, logEvent, newRequestId } from "../_shared/http.ts";
import { adminClient } from "../_shared/auth.ts";
import { sendEmail } from "../_shared/email.ts";

const InputSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(200),
  company: z.string().max(160).optional(),
  teamSize: z.string().max(40).optional(),
  sellsWhat: z.string().max(200).optional(),
  prospectingVolume: z.string().max(40).optional(),
  whatsapp: z.string().max(30).optional(),
  message: z.string().min(5).max(2000),
  source: z.string().max(80).optional(),
  utm: z.record(z.string(), z.string()).optional(),
  // Honeypot — real users never see or fill this field.
  website: z.string().max(200).optional(),
});

Deno.serve(async (req) => {
  const opts = handleOptions(req);
  if (opts) return opts;
  const requestId = newRequestId();

  try {
    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", "Dados do formulário inválidos.", {
        issues: parsed.error.issues,
      });
    }
    const input = parsed.data;

    // Bot filled the trap field — pretend success, don't write anything.
    if (input.website && input.website.trim().length > 0) {
      logEvent({ requestId, operation: "submit-sales-contact", status: "honeypot" });
      return json({ ok: true }, 200, {}, req);
    }

    const admin = adminClient();

    const { count } = await admin
      .from("sales_contacts")
      .select("id", { count: "exact", head: true })
      .eq("email", input.email)
      .gte("created_at", new Date(Date.now() - 60_000).toISOString());
    if ((count ?? 0) > 0) {
      throw new AppError("RATE_LIMIT_EXCEEDED", "Aguarde um instante antes de enviar de novo.", {
        retryAfterSeconds: 60,
      });
    }

    const { error } = await admin.from("sales_contacts").insert({
      name: input.name,
      email: input.email,
      company: input.company ?? null,
      team_size: input.teamSize ?? null,
      sells_what: input.sellsWhat ?? null,
      prospecting_volume: input.prospectingVolume ?? null,
      whatsapp: input.whatsapp ?? null,
      message: input.message,
      source: input.source ?? null,
      utm: input.utm ?? null,
    });
    if (error) throw new AppError("INTERNAL_ERROR", "Falha ao enviar sua mensagem.");

    // Writing the row alone leaves this silent — nobody was reading
    // sales_contacts anywhere (not even the admin panel). This is the manual
    // payment path for paid signups until checkout exists, so a real person
    // has to actually see it.
    const notifyTo = Deno.env.get("SALES_NOTIFY_EMAIL");
    if (notifyTo) {
      await sendEmail({
        to: notifyTo,
        subject: `Novo contato de vendas — ${input.source ?? "site"}: ${input.name}`,
        html: `
          <p><strong>${input.name}</strong> (${input.email})${input.company ? ` — ${input.company}` : ""}</p>
          ${input.whatsapp ? `<p>WhatsApp: ${input.whatsapp}</p>` : ""}
          ${input.teamSize ? `<p>Equipe: ${input.teamSize}</p>` : ""}
          ${input.sellsWhat ? `<p>Vende: ${input.sellsWhat}</p>` : ""}
          ${input.prospectingVolume ? `<p>Volume de prospecção: ${input.prospectingVolume}</p>` : ""}
          <p>Origem: ${input.source ?? "desconhecida"}</p>
          <p>Mensagem:</p>
          <p>${input.message}</p>
        `,
      });
    } else {
      logEvent({
        level: "warn",
        requestId,
        operation: "submit-sales-contact",
        status: "no_notify_email",
      });
    }

    logEvent({ requestId, operation: "submit-sales-contact", status: "ok" });
    return json({ ok: true }, 200, {}, req);
  } catch (err) {
    if (err instanceof AppError) return err.toResponse(requestId, req);
    return new AppError("INTERNAL_ERROR", "Erro interno.").toResponse(requestId, req);
  }
});
