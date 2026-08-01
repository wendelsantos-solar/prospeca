# AI First-Contact Message Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user generate an AI-written first-contact WhatsApp opener from a lead's real signal (no website / low rating / category / city), as an opt-in alternative to the fixed `{{variable}}` template — never automatic, never replacing the template.

**Architecture:** New Supabase Edge Function `generate-contact-message` (same `requireAuth` + `assertRateLimit` pattern as `enrich-lead`/`calculate-lead-score`) computes a signal-sufficiency heuristic, and — only when sufficient — calls the Anthropic Messages API (Claude Haiku 4.5) with a short system prompt. Frontend gets a thin `invokeFunction` wrapper (mirrors `reverse-geocode.ts`). Two UI entry points reuse the existing `PrepareMessageDialog`: a "Gerar com IA" button (manual, from `LeadDetailsDrawer`'s existing mount) and `NbaCard`'s first-contact CTA, which now opens the dialog with generation auto-triggered instead of jumping straight to wa.me.

**Tech Stack:** Deno edge function (existing `_shared/http.ts`/`auth.ts`/`quota.ts` helpers), Anthropic Messages API via raw `fetch` (no SDK), React/TanStack (existing `PrepareMessageDialog`/`NbaCard`), Bun test for pure logic.

## Global Constraints

- Provider/model: Claude Haiku 4.5, model id `claude-haiku-4-5-20251001`, via `ANTHROPIC_API_KEY` secret — never call from the client.
- Opt-in only: template stays the default everywhere; AI generation only replaces the draft when the user asks for it (button click) or, for first contact, when the dialog auto-triggers it — but the user always sees the result before sending (dialog, not direct wa.me).
- Signal-sufficiency heuristic (server-side, exact): sufficient if **any** of — `!hasWebsite`, or (`rating < 4.0 && reviewCount >= 3`), or (`reviewCount === 0 && hasWebsite`). Otherwise `{ ok: false, reason: "insufficient_signal" }`.
- Rate limit: reuse `assertRateLimit(admin, organizationId, "ai_message_generate", 10)` (10/minute per org — same helper signature as `enrich-lead`'s `assertRateLimit(ctx.adminClient, ctx.organizationId, "enrich_request", 20)`).
- Only toque 1 (first contact, `lead.stage === "new"`) gets AI generation. Cadence steps 2-4 (`cadence.ts`) keep their fixed `messageOpener` strings — no code path here touches `cadence.ts` or `nba.ts`.
- Any failure (missing key, network, non-2xx from Anthropic, empty completion) returns HTTP 200 with `{ ok: false, reason: "generation_failed" }` — never throws to the client for this case. The client always still has the template in the textarea; failure is a discreet toast, not a blocking error.
- No new DB table, no persistence of the generated message — it's a one-shot draft exactly like the textarea in `PrepareMessageDialog` today.

---

### Task 1: Signal heuristic + prompt builder (pure logic, `_shared/ai-message.ts`)

**Files:**
- Create: `supabase/functions/_shared/ai-message.ts`
- Test: `supabase/functions/_shared/ai-message.test.ts`

**Interfaces:**
- Produces: `LeadSignal` interface, `hasEnoughSignal(lead: LeadSignal): boolean`, `buildUserPrompt(lead: LeadSignal): string`, `SYSTEM_PROMPT: string`, `AI_MESSAGE_MODEL: string` (`"claude-haiku-4-5-20251001"`) — all consumed by Task 2 (`generate-contact-message/index.ts`).

- [ ] **Step 1: Write the failing test**

```ts
// supabase/functions/_shared/ai-message.test.ts
import { expect, test } from "bun:test";
import { hasEnoughSignal, buildUserPrompt, type LeadSignal } from "./ai-message.ts";

const base = (o: Partial<LeadSignal>): LeadSignal => ({
  companyName: "Salão da Ana",
  category: "hair_salon",
  city: "Florianópolis",
  neighborhood: "Centro",
  hasWebsite: true,
  rating: null,
  reviewCount: null,
  ...o,
});

test("hasEnoughSignal: no website is always enough signal", () => {
  expect(hasEnoughSignal(base({ hasWebsite: false, rating: 4.8, reviewCount: 200 }))).toBe(true);
});

test("hasEnoughSignal: website + good rating + reviews is NOT enough", () => {
  expect(hasEnoughSignal(base({ hasWebsite: true, rating: 4.8, reviewCount: 50 }))).toBe(false);
});

test("hasEnoughSignal: website + low rating with 3+ reviews IS enough", () => {
  expect(hasEnoughSignal(base({ hasWebsite: true, rating: 3.2, reviewCount: 3 }))).toBe(true);
});

test("hasEnoughSignal: website + low rating but under 3 reviews is NOT enough", () => {
  expect(hasEnoughSignal(base({ hasWebsite: true, rating: 3.2, reviewCount: 2 }))).toBe(false);
});

test("hasEnoughSignal: website + zero reviews IS enough", () => {
  expect(hasEnoughSignal(base({ hasWebsite: true, rating: null, reviewCount: 0 }))).toBe(true);
});

test("hasEnoughSignal: website + no rating/reviews at all is NOT enough", () => {
  expect(hasEnoughSignal(base({ hasWebsite: true, rating: null, reviewCount: null }))).toBe(false);
});

test("buildUserPrompt includes company, humanized category, city, neighborhood, website + rating lines", () => {
  const prompt = buildUserPrompt(
    base({ hasWebsite: false, rating: 3.1, reviewCount: 5, category: "hair_salon" }),
  );
  expect(prompt).toContain("Empresa: Salão da Ana");
  expect(prompt).toContain("Categoria: hair salon");
  expect(prompt).toContain("Cidade: Florianópolis");
  expect(prompt).toContain("Bairro: Centro");
  expect(prompt).toContain("Tem site: não");
  expect(prompt).toContain("Nota: 3.1");
  expect(prompt).toContain("Número de avaliações: 5");
});

test("buildUserPrompt omits optional fields that are null", () => {
  const prompt = buildUserPrompt(
    base({ category: null, city: null, neighborhood: null, rating: null, reviewCount: null }),
  );
  expect(prompt).not.toContain("Categoria:");
  expect(prompt).not.toContain("Cidade:");
  expect(prompt).not.toContain("Bairro:");
  expect(prompt).not.toContain("Nota:");
  expect(prompt).not.toContain("Número de avaliações:");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test supabase/functions/_shared/ai-message.test.ts`
Expected: FAIL — `Cannot find module './ai-message.ts'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```ts
// supabase/functions/_shared/ai-message.ts
// Pure logic for the "AI first-contact message" feature (roadmap 3.5). No I/O
// here — the edge function (generate-contact-message/index.ts) owns the
// Anthropic fetch call and the DB read. Kept separate and dependency-free so
// it runs under `bun test` despite living in the Deno functions tree (same
// convention as _shared/refresh.ts / refresh.test.ts).

export interface LeadSignal {
  companyName: string;
  category: string | null;
  city: string | null;
  neighborhood: string | null;
  hasWebsite: boolean;
  rating: number | null;
  reviewCount: number | null;
}

export const AI_MESSAGE_MODEL = "claude-haiku-4-5-20251001";

export const SYSTEM_PROMPT = `Você escreve a abertura de uma mensagem de WhatsApp de primeiro contato comercial B2B, em português do Brasil, para um vendedor abordar um negócio local.

Regras:
- 2 a 3 frases, tom consultivo e direto, nunca genérico ou robótico.
- Baseie-se SOMENTE nos dados fornecidos. Nunca invente fatos, números ou observações que não vieram no prompt.
- Nunca comece com saudação genérica tipo "Olá, tudo bem?" — vá direto ao motivo do contato.
- Não assine, não use placeholders como {{empresa}} — escreva o nome da empresa por extenso quando fizer sentido.
- Responda apenas com o texto da mensagem, sem aspas, sem explicação.`;

/** Server-side gate on whether there's enough real signal to bother the LLM.
 * Never generate a message that would read as specific when it isn't. */
export function hasEnoughSignal(lead: LeadSignal): boolean {
  if (!lead.hasWebsite) return true;
  if (lead.rating != null && lead.rating < 4.0 && (lead.reviewCount ?? 0) >= 3) return true;
  if (lead.reviewCount === 0 && lead.hasWebsite) return true;
  return false;
}

export function buildUserPrompt(lead: LeadSignal): string {
  const lines: string[] = [`Empresa: ${lead.companyName}`];
  if (lead.category) lines.push(`Categoria: ${lead.category.replaceAll("_", " ")}`);
  if (lead.city) lines.push(`Cidade: ${lead.city}`);
  if (lead.neighborhood) lines.push(`Bairro: ${lead.neighborhood}`);
  lines.push(`Tem site: ${lead.hasWebsite ? "sim" : "não"}`);
  if (lead.rating != null) lines.push(`Nota: ${lead.rating}`);
  if (lead.reviewCount != null) lines.push(`Número de avaliações: ${lead.reviewCount}`);
  return lines.join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test supabase/functions/_shared/ai-message.test.ts`
Expected: `9 pass, 0 fail`

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/ai-message.ts supabase/functions/_shared/ai-message.test.ts
git commit -m "feat: signal heuristic and prompt builder for AI first-contact message"
```

---

### Task 2: `generate-contact-message` edge function

**Files:**
- Create: `supabase/functions/generate-contact-message/index.ts`
- Modify: `.env.example` (document the new secret)

**Interfaces:**
- Consumes: `hasEnoughSignal`, `buildUserPrompt`, `SYSTEM_PROMPT`, `AI_MESSAGE_MODEL`, `LeadSignal` from Task 1 (`../_shared/ai-message.ts`); `requireAuth` from `../_shared/auth.ts`; `assertRateLimit` from `../_shared/quota.ts`; `AppError`, `handleOptions`, `json`, `logEvent`, `newRequestId` from `../_shared/http.ts`.
- Produces: POST endpoint `generate-contact-message` taking `{ leadId: string }`, returning `200 { ok: true, message: string }` or `200 { ok: false, reason: "insufficient_signal" | "generation_failed" }`, consumed by Task 3 (`apps/web/src/lib/ai-message.ts`).

- [ ] **Step 1: Write the implementation**

```ts
// supabase/functions/generate-contact-message/index.ts
// Generates an AI-written first-contact WhatsApp opener from a lead's real
// signal (no website / low rating / review count). Opt-in only — the
// frontend template stays the default; this is a "Gerar com IA" button.
// Never fabricates a message when the lead lacks real signal (see
// hasEnoughSignal in _shared/ai-message.ts) — returns insufficient_signal
// instead, and the frontend silently falls back to the template.
import { z } from "npm:zod@3";
import { AppError, handleOptions, json, logEvent, newRequestId } from "../_shared/http.ts";
import { requireAuth } from "../_shared/auth.ts";
import { assertRateLimit } from "../_shared/quota.ts";
import {
  hasEnoughSignal,
  buildUserPrompt,
  SYSTEM_PROMPT,
  AI_MESSAGE_MODEL,
  type LeadSignal,
} from "../_shared/ai-message.ts";

const InputSchema = z.object({ leadId: z.string().uuid() });

Deno.serve(async (req) => {
  const opts = handleOptions(req);
  if (opts) return opts;
  const requestId = newRequestId();

  try {
    const ctx = await requireAuth(req);
    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Entrada inválida.");

    await assertRateLimit(ctx.adminClient, ctx.organizationId, "ai_message_generate", 10);

    const { data: lead } = await ctx.userClient
      .from("leads")
      .select("id, company_name, category, city, neighborhood, has_website, rating, review_count")
      .eq("id", parsed.data.leadId)
      .maybeSingle();
    if (!lead) throw new AppError("LEAD_NOT_FOUND", "Lead não encontrado.");

    const signal: LeadSignal = {
      companyName: lead.company_name,
      category: lead.category,
      city: lead.city,
      neighborhood: lead.neighborhood,
      hasWebsite: lead.has_website,
      rating: lead.rating,
      reviewCount: lead.review_count,
    };

    if (!hasEnoughSignal(signal)) {
      logEvent({ requestId, operation: "generate-contact-message", status: "insufficient_signal" });
      return json({ ok: false, reason: "insufficient_signal" }, 200, {}, req);
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      logEvent({ requestId, operation: "generate-contact-message", status: "no_api_key" });
      return json({ ok: false, reason: "generation_failed" }, 200, {}, req);
    }

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: AI_MESSAGE_MODEL,
          max_tokens: 200,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: buildUserPrompt(signal) }],
        }),
      });

      if (!res.ok) {
        logEvent({
          requestId,
          operation: "generate-contact-message",
          status: "provider_error",
          httpStatus: res.status,
        });
        return json({ ok: false, reason: "generation_failed" }, 200, {}, req);
      }

      const data = await res.json();
      const message = (data?.content?.[0]?.text ?? "").trim();
      if (!message) {
        logEvent({ requestId, operation: "generate-contact-message", status: "empty_completion" });
        return json({ ok: false, reason: "generation_failed" }, 200, {}, req);
      }

      logEvent({ requestId, operation: "generate-contact-message", status: "ok" });
      return json({ ok: true, message }, 200, {}, req);
    } catch (err) {
      logEvent({
        requestId,
        operation: "generate-contact-message",
        status: "fetch_failed",
        message: err instanceof Error ? err.message : String(err),
      });
      return json({ ok: false, reason: "generation_failed" }, 200, {}, req);
    }
  } catch (err) {
    if (err instanceof AppError) return err.toResponse(requestId, req);
    return new AppError("INTERNAL_ERROR", "Erro interno.").toResponse(requestId, req);
  }
});
```

- [ ] **Step 2: Type-check the function**

Run: `deno check supabase/functions/generate-contact-message/index.ts`
Expected: `Check supabase/functions/generate-contact-message/index.ts` with no errors. (This checkout has a working local Deno install — confirmed via `deno check supabase/functions/calculate-lead-score/index.ts` succeeding.)

- [ ] **Step 3: Document the new secret**

Edit `.env.example` — in the `# ── Edge Functions (Supabase secrets — set via \`supabase secrets set\`) ─` block, right after `GOOGLE_MAPS_SERVER_KEY=` and its comment (around line 32), add:

```env
# Anthropic API key — used by generate-contact-message (roadmap 3.5, AI
# first-contact opener). Model: claude-haiku-4-5-20251001. Feature degrades
# to "generation_failed" (frontend falls back to the template) if absent.
ANTHROPIC_API_KEY=
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/generate-contact-message/index.ts .env.example
git commit -m "feat: generate-contact-message edge function (roadmap 3.5)"
```

---

### Task 3: Frontend wrapper — `apps/web/src/lib/ai-message.ts`

**Files:**
- Create: `apps/web/src/lib/ai-message.ts`

**Interfaces:**
- Consumes: `invokeFunction` from `@/lib/supabase` (existing — see `apps/web/src/lib/reverse-geocode.ts` for the exact same wrapper shape).
- Produces: `generateContactMessage(leadId: string): Promise<GenerateContactMessageResult>` where `GenerateContactMessageResult = { ok: true; message: string } | { ok: false; reason: "insufficient_signal" | "generation_failed" }` — consumed by Task 4 (`PrepareMessageDialog.tsx`).

No dedicated test file for this task — it's a thin try/catch wrapper around `invokeFunction`, the same shape as the existing (untested) `reverse-geocode.ts`. Mocking the Supabase client for a 6-line pass-through isn't worth it in this codebase's existing convention; behavior is covered by the manual E2E in Task 6.

- [ ] **Step 1: Write the implementation**

```ts
// apps/web/src/lib/ai-message.ts
import { invokeFunction } from "@/lib/supabase";

export type GenerateContactMessageResult =
  | { ok: true; message: string }
  | { ok: false; reason: "insufficient_signal" | "generation_failed" };

/**
 * Generates an AI-written first-contact opener from the lead's real signal
 * (see supabase/functions/_shared/ai-message.ts for the heuristic). Never
 * throws — any failure (network, rate limit, provider down) collapses to
 * `{ ok: false, reason: "generation_failed" }` so the caller can silently
 * keep the template draft instead of showing a blocking error.
 */
export async function generateContactMessage(leadId: string): Promise<GenerateContactMessageResult> {
  try {
    return await invokeFunction<GenerateContactMessageResult>("generate-contact-message", {
      leadId,
    });
  } catch {
    return { ok: false, reason: "generation_failed" };
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: `3 successful, 3 total` (no new errors in `@leads/web`).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/ai-message.ts
git commit -m "feat: frontend wrapper for generate-contact-message"
```

---

### Task 4: "Gerar com IA" button in `PrepareMessageDialog`

**Files:**
- Modify: `apps/web/src/components/app/PrepareMessageDialog.tsx`

**Interfaces:**
- Consumes: `generateContactMessage` from `@/lib/ai-message` (Task 3).
- Produces: new optional prop `autoGenerate?: boolean` on `PrepareMessageDialog` — consumed by Task 5 (`NbaCard.tsx`).

- [ ] **Step 1: Add the import, `aiLoading` state, and `handleGenerateAi`**

In `apps/web/src/components/app/PrepareMessageDialog.tsx`, add the import and extend the component:

```tsx
import { useEffect, useRef, useState } from "react";
import { Copy, MessageCircle, Sparkles, Loader2 } from "lucide-react";
// ...existing imports...
import { generateContactMessage } from "@/lib/ai-message";
```

Replace the component signature and the reset effect (the existing `useState`/`useEffect` block) with:

```tsx
export function PrepareMessageDialog({
  lead,
  open,
  onOpenChange,
  materialize,
  autoGenerate = false,
}: {
  lead: Lead;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Set when the target is a discovery result not yet in the funnel. */
  materialize?: { searchId: string; placeId: string };
  /** Trigger AI generation once, automatically, the first time the dialog
   * opens — used by NbaCard's first-contact CTA so the user reviews an
   * AI-written opener instead of the raw template. */
  autoGenerate?: boolean;
}) {
  const template = useMessageStore((s) => s.template);
  const senderName = useSettingsStore((s) => s.senderName);
  const userName = useSettingsStore((s) => s.userName);
  const companyName = useSettingsStore((s) => s.companyName);
  const signature = useSettingsStore((s) => s.signature);
  const { openWhatsApp } = useOutbound();
  const [draft, setDraft] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const autoGeneratedRef = useRef(false);

  async function handleGenerateAi() {
    setAiLoading(true);
    const result = await generateContactMessage(lead.id);
    setAiLoading(false);
    if (result.ok) {
      setDraft(result.message);
    } else if (result.reason === "insufficient_signal") {
      toast("Sinal insuficiente para IA — mantendo o modelo padrão.");
    } else {
      toast.error("Não foi possível gerar com IA agora — mantendo o modelo padrão.");
    }
  }

  // Reset to the freshly rendered template each time the dialog is opened —
  // editing is scoped to one send, not persisted as the lead's message.
  useEffect(() => {
    if (!open) {
      autoGeneratedRef.current = false;
      return;
    }
    setDraft(buildContactMessage(template, lead, { senderName, userName, companyName, signature }));
  }, [open, template, lead, senderName, userName, companyName, signature]);

  // Auto-trigger AI generation once per open (not on every dep change above).
  useEffect(() => {
    if (open && autoGenerate && !autoGeneratedRef.current) {
      autoGeneratedRef.current = true;
      handleGenerateAi();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoGenerate]);
```

- [ ] **Step 2: Add the "Gerar com IA" button next to Copiar/Abrir WhatsApp**

Replace the button row (the `<div className="flex gap-2">...</div>` containing Copiar and Abrir WhatsApp) with:

```tsx
<div className="flex gap-2">
  <Button
    size="sm"
    variant="outline"
    disabled={aiLoading}
    onClick={handleGenerateAi}
    title="Gerar abertura específica a partir do sinal do lead (site/nota/avaliações)"
  >
    {aiLoading ? (
      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
    ) : (
      <Sparkles className="mr-1 h-3.5 w-3.5" />
    )}
    {aiLoading ? "Gerando..." : "Gerar com IA"}
  </Button>
  <Button
    size="sm"
    variant="outline"
    onClick={() => {
      navigator.clipboard.writeText(draft);
      toast.success("Copiado");
    }}
  >
    <Copy className="mr-1 h-3.5 w-3.5" />
    Copiar
  </Button>
  <Button
    size="sm"
    onClick={async () => {
      const sent = await openWhatsApp(lead, { message: draft, materialize });
      if (sent) onOpenChange(false);
    }}
  >
    <MessageCircle className="mr-1 h-3.5 w-3.5" />
    Abrir WhatsApp
  </Button>
</div>
```

- [ ] **Step 3: Typecheck and lint**

Run: `bun run typecheck && bun run lint`
Expected: both pass, `3 successful, 3 total` each.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/app/PrepareMessageDialog.tsx
git commit -m "feat: add Gerar com IA button to PrepareMessageDialog"
```

---

### Task 5: Wire `NbaCard`'s first-contact CTA to the dialog

**Files:**
- Modify: `apps/web/src/components/app/NbaCard.tsx`

**Interfaces:**
- Consumes: `PrepareMessageDialog` with its new `autoGenerate` prop (Task 4).

- [ ] **Step 1: Add dialog state and the `isFirstContact` gate**

In `apps/web/src/components/app/NbaCard.tsx`, add the import and state:

```tsx
import { useState } from "react";
import { MessageCircle, PhoneCall, Mail, Sparkles, Clock, ArrowRight } from "lucide-react";
import type { Lead } from "@/types";
import { computeNba, type NbaChannel, type NbaPriority } from "@/lib/nba";
import { CADENCE_STEPS } from "@/lib/cadence";
import { buildContactMessage } from "@/lib/message-fill";
import { PrepareMessageDialog } from "@/components/app/PrepareMessageDialog";
import { useOutbound } from "@/hooks/useOutbound";
import { useLeadsStore, useMessageStore, useSettingsStore } from "@/stores";
import { cn } from "@/lib/utils";
```

Inside `NbaCard`, right after `const nba = computeNba(lead);`, add:

```tsx
const [dialogOpen, setDialogOpen] = useState(false);
// Only the very first touch gets AI generation (roadmap 3.5) — cadence
// steps 2-4 already have their own fixed opener from cadence.ts and keep
// going straight to wa.me, unchanged.
const isFirstContact = lead.stage === "new" && nba.channel === "whatsapp";
```

- [ ] **Step 2: Branch `handleCta` on `isFirstContact`**

Replace `handleCta` with:

```tsx
async function handleCta() {
  if (isFirstContact) {
    setDialogOpen(true);
    return;
  }
  if (nba.channel === "whatsapp") {
    // Cadence touches (contacted, step due) get an escalating opener
    // instead of resending the exact same first-contact template.
    const message = nba.cadenceStep?.messageOpener
      ? buildContactMessage(
          template,
          {
            companyName: lead.companyName,
            category: lead.category,
            city: lead.city,
            neighborhood: lead.neighborhood,
            phone: lead.phone,
            instagram: lead.instagram,
            website: lead.website,
          },
          { senderName, userName, signature },
          nba.cadenceStep.messageOpener,
        )
      : undefined;
    if (await openWhatsApp(lead, message ? { message } : undefined)) return;
  }
  setDetails(lead.id);
}
```

- [ ] **Step 3: Mount the dialog**

At the end of the component's returned JSX, right before the closing `</div>` of the outermost `<div className="mb-4 ...">`, add:

```tsx
      {isFirstContact && (
        <PrepareMessageDialog lead={lead} open={dialogOpen} onOpenChange={setDialogOpen} autoGenerate />
      )}
    </div>
  );
}
```

(i.e. the dialog sits as a sibling after the existing content, still inside the top-level wrapper div.)

- [ ] **Step 4: Typecheck, lint, run the full test suite**

Run: `bun run typecheck && bun run lint && bun run test`
Expected: typecheck/lint both `3 successful, 3 total`; test `93 pass, 0 fail` (unchanged — no new automated tests for this component-level wiring, matches the codebase's existing convention of no `.test.tsx` files).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/app/NbaCard.tsx
git commit -m "feat: NbaCard first-contact CTA opens AI-assisted message dialog"
```

---

### Task 6: Manual E2E verification

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server in demo mode**

Run: `bun run dev:web` (uses whatever `VITE_DATA_MODE` is currently set — demo mode needs no `ANTHROPIC_API_KEY` and will naturally exercise the `generation_failed`/network-unavailable path since there's no local Supabase functions server running against demo data)

- [ ] **Step 2: Confirm a "new" stage lead with no website shows the AI dialog path**

In the browser, open a lead in "new" stage with `hasWebsite: false` (demo data has these). Click the NBA card's CTA button ("Preparar abordagem"). Expected: `PrepareMessageDialog` opens (not a direct wa.me tab), the "Gerar com IA" button shows a brief loading spinner, then either fills the draft with an AI-written message (if a live `ANTHROPIC_API_KEY` + edge function are reachable) or falls back with a toast while the template stays in the textarea (in demo mode, since there's no edge function to hit).

- [ ] **Step 3: Confirm cadence touches (contacted stage) are unchanged**

Open a lead in "contacted" stage with `lastInteractionAt` a few days in the past. Click the NBA card CTA. Expected: opens wa.me directly (no dialog), prefilled with the cadence step's opener + template — same behavior as before this feature, confirming toques 2-4 weren't touched.

- [ ] **Step 4: Confirm manual "Gerar com IA" in the lead drawer**

Open any lead's details drawer → "Preparar mensagem". Click "Gerar com IA". Expected: loading state, then either an AI draft or a toast + unchanged template — never a blank textarea, never a thrown/uncaught error in the console.

- [ ] **Step 5: Stop the dev server**

Confirm no leftover dev server process and `.env.local` still has whatever `VITE_DATA_MODE` was set before this session (don't leave a debug override committed).

---

## Spec Coverage Check

- Edge function location/pattern (`requireAuth` + `assertRateLimit`, Haiku 4.5, `ANTHROPIC_API_KEY`) → Task 2.
- Opt-in, never replaces template → Task 4 (button, not auto-replace) + Task 5 (dialog always shown before send).
- Signal-sufficiency heuristic → Task 1, exercised by Task 2.
- Rate limit 10/min → Task 2.
- Only toque 1 → Task 5's `isFirstContact` gate; `cadence.ts`/`nba.ts` untouched.
- Silent fallback on any failure → Task 1 (`hasEnoughSignal` early return), Task 2 (all error paths return 200 `ok:false`), Task 3 (catch-all), Task 4 (toast, template stays).
- Prompt content/rules → Task 1 `SYSTEM_PROMPT`/`buildUserPrompt`.
- Testing plan (pure-logic unit tests, manual E2E, cadence-unchanged check) → Task 1 tests + Task 6.
