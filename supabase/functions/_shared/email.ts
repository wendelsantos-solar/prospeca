// E-mail abstraction — lightweight wrapper for transactional emails.
//
// For beta: logs to console and can optionally send via Resend/SMTP.
// Never blocks the main flow — failures are logged but don't throw.
//
// Environment variables:
//   RESEND_API_KEY — Resend API key (optional for production)
//   SMTP_* — SMTP config (fallback)

import { logEvent } from "./http.ts";

export interface EmailInput {
  to: string;
  subject: string;
  html: string;
  /** Optional plain-text fallback */
  text?: string;
}

/**
 * Send an email. In development (no API key), logs to console.
 * In production, uses Resend API or SMTP.
 */
export async function sendEmail(input: EmailInput): Promise<void> {
  const resendKey = Deno.env.get("RESEND_API_KEY");

  if (resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: Deno.env.get("SMTP_FROM") ?? "Radar Local <suporte@radarlocal.com.br>",
          to: input.to,
          subject: input.subject,
          html: input.html,
          text: input.text,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        logEvent({
          level: "error",
          service: "email",
          operation: "send",
          status: "fail",
          provider: "resend",
          error: body.slice(0, 500),
        });
        return;
      }

      logEvent({
        level: "info",
        service: "email",
        operation: "send",
        status: "ok",
        provider: "resend",
        to: input.to,
        subject: input.subject,
      });
    } catch (err) {
      logEvent({
        level: "error",
        service: "email",
        operation: "send",
        status: "fail",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
    return;
  }

  // No email provider configured — log to console (dev mode)
  logEvent({
    level: "info",
    service: "email",
    operation: "send",
    status: "simulated",
    to: input.to,
    subject: input.subject,
  });
  console.log(`\n── EMAIL ────────────────────────────────────`);
  console.log(`To: ${input.to}`);
  console.log(`Subject: ${input.subject}`);
  console.log(`Body: ${input.html.slice(0, 500)}...`);
  console.log(`──────────────────────────────────────────────\n`);
}
