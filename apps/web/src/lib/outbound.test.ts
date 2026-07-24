import { describe, it, expect } from "bun:test";
import { planWhatsApp, hasWhatsAppTarget, WHATSAPP_REFUSAL_MESSAGE } from "./outbound";
import { suppressionHash } from "./suppression";

const MOBILE = "(11) 99999-8888";
const LANDLINE = "(11) 3333-4444";

describe("planWhatsApp", () => {
  it("uses a scraped whatsapp verbatim, without inference", async () => {
    const plan = await planWhatsApp({ whatsapp: "+55 11 99999-8888", phone: LANDLINE }, undefined);
    expect(plan).toEqual({
      ok: true,
      url: "https://wa.me/5511999998888",
      number: "5511999998888",
      probable: false,
    });
  });

  it("infers a WhatsApp from a Brazilian mobile phone", async () => {
    const plan = await planWhatsApp({ phone: MOBILE }, undefined);
    expect(plan).toEqual({
      ok: true,
      url: "https://wa.me/5511999998888",
      number: "5511999998888",
      probable: true,
    });
  });

  it("refuses a landline — it is not a WhatsApp", async () => {
    expect(await planWhatsApp({ phone: LANDLINE }, undefined)).toEqual({
      ok: false,
      reason: "not-whatsapp",
    });
  });

  it("refuses an unparseable number", async () => {
    expect(await planWhatsApp({ phone: "123" }, undefined)).toEqual({
      ok: false,
      reason: "not-whatsapp",
    });
  });

  it("refuses when there is no number at all", async () => {
    expect(await planWhatsApp({ phone: null, whatsapp: null }, undefined)).toEqual({
      ok: false,
      reason: "no-number",
    });
  });

  it("refuses a suppressed phone (LGPD opt-out)", async () => {
    const suppressed = new Set([await suppressionHash("phone", MOBILE)]);
    expect(await planWhatsApp({ phone: MOBILE }, suppressed)).toEqual({
      ok: false,
      reason: "suppressed",
    });
  });

  it("refuses a suppressed email even when the phone is dialable", async () => {
    const suppressed = new Set([await suppressionHash("email", "a@b.com")]);
    expect(await planWhatsApp({ phone: MOBILE, email: "a@b.com" }, suppressed)).toEqual({
      ok: false,
      reason: "suppressed",
    });
  });

  it("allows a contact that is not on the opt-out list", async () => {
    const suppressed = new Set([await suppressionHash("phone", "(21) 98888-7777")]);
    const plan = await planWhatsApp({ phone: MOBILE }, suppressed);
    expect(plan.ok).toBe(true);
  });

  it("skips the opt-out check while the list is still loading", async () => {
    const plan = await planWhatsApp({ phone: MOBILE }, undefined);
    expect(plan.ok).toBe(true);
  });

  it("url-encodes a prefilled message", async () => {
    const plan = await planWhatsApp({ phone: MOBILE }, undefined, "Olá, tudo bem?");
    expect(plan).toMatchObject({
      ok: true,
      url: "https://wa.me/5511999998888?text=Ol%C3%A1%2C%20tudo%20bem%3F",
    });
  });

  it("has pt-BR copy for every refusal reason", () => {
    expect(Object.keys(WHATSAPP_REFUSAL_MESSAGE).sort()).toEqual([
      "no-number",
      "not-whatsapp",
      "suppressed",
    ]);
  });
});

describe("hasWhatsAppTarget", () => {
  it("is true for a scraped whatsapp and for a mobile phone", () => {
    expect(hasWhatsAppTarget({ whatsapp: "5511999998888" })).toBe(true);
    expect(hasWhatsAppTarget({ phone: MOBILE })).toBe(true);
  });

  it("is false for a landline and for no number", () => {
    expect(hasWhatsAppTarget({ phone: LANDLINE })).toBe(false);
    expect(hasWhatsAppTarget({})).toBe(false);
  });
});
