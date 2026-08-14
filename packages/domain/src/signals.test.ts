import { describe, expect, test } from "bun:test";
import {
  buildSignalEvidence,
  COMPANY_SIGNALS,
  deriveSignals,
  hasSignal,
  signalSeverity,
  type SignalContext,
} from "./signals";

const base: SignalContext = {
  hasWebsite: false,
  hasValidPhone: false,
  whatsappStatus: "unknown",
  hasEmail: false,
  rating: null,
  reviewCount: null,
  businessStatus: null,
};

describe("deriveSignals", () => {
  test("no website + no other data → only NO_WEBSITE", () => {
    const s = deriveSignals(base);
    expect(s).toEqual(["NO_WEBSITE"]);
  });

  test("operational + verified whatsapp + email + high rating", () => {
    const s = deriveSignals({
      ...base,
      hasWebsite: true,
      hasValidPhone: true,
      whatsappStatus: "verified",
      hasEmail: true,
      rating: 4.7,
      reviewCount: 40,
      businessStatus: "OPERATIONAL",
    });
    expect(hasSignal(s, "BUSINESS_ACTIVE")).toBe(true);
    expect(hasSignal(s, "WHATSAPP_VALIDATED")).toBe(true);
    expect(hasSignal(s, "HAS_EMAIL")).toBe(true);
    expect(hasSignal(s, "HIGH_RATING")).toBe(true);
    expect(hasSignal(s, "NO_WEBSITE")).toBe(false);
  });

  test("whatsapp 'possible' maps to AVAILABLE, not VALIDATED", () => {
    const s = deriveSignals({ ...base, whatsappStatus: "possible" });
    expect(hasSignal(s, "WHATSAPP_AVAILABLE")).toBe(true);
    expect(hasSignal(s, "WHATSAPP_VALIDATED")).toBe(false);
  });

  test("weak reputation and low review count are both emitted", () => {
    const s = deriveSignals({ ...base, rating: 3.0, reviewCount: 5 });
    expect(hasSignal(s, "WEAK_REPUTATION")).toBe(true);
    expect(hasSignal(s, "LOW_REVIEW_COUNT")).toBe(true);
  });

  test("instagram followers ≤ 1000 → INSTAGRAM_WEAK; 0 → absent (not weak)", () => {
    expect(hasSignal(deriveSignals({ ...base, instagramFollowers: 500 }), "INSTAGRAM_WEAK")).toBe(
      true,
    );
    expect(hasSignal(deriveSignals({ ...base, instagramFollowers: 0 }), "INSTAGRAM_WEAK")).toBe(
      false,
    );
    expect(
      hasSignal(deriveSignals({ ...base, instagramFollowers: null }), "INSTAGRAM_WEAK"),
    ).toBe(false);
  });

  test("territory context emits density/competition signals", () => {
    const s = deriveSignals({ ...base, localDensity: 0.8, lowDigitalCompetition: true });
    expect(hasSignal(s, "HIGH_LOCAL_DENSITY")).toBe(true);
    expect(hasSignal(s, "LOW_DIGITAL_COMPETITION")).toBe(true);
  });

  test("new business flag is emitted only when explicitly true", () => {
    expect(hasSignal(deriveSignals({ ...base, isNewBusiness: true }), "NEW_BUSINESS")).toBe(true);
    expect(hasSignal(deriveSignals({ ...base, isNewBusiness: false }), "NEW_BUSINESS")).toBe(
      false,
    );
    expect(hasSignal(deriveSignals(base), "NEW_BUSINESS")).toBe(false);
  });
});

describe("signalSeverity", () => {
  test("every company signal has a severity (no gaps)", () => {
    for (const signal of COMPANY_SIGNALS) {
      expect(["high", "medium", "low"]).toContain(signalSeverity(signal));
    }
  });
  test("opportunity-gap signals are high, positive facts are low", () => {
    expect(signalSeverity("NO_WEBSITE")).toBe("high");
    expect(signalSeverity("WEAK_REPUTATION")).toBe("high");
    expect(signalSeverity("LOW_REVIEW_COUNT")).toBe("medium");
    expect(signalSeverity("BUSINESS_ACTIVE")).toBe("low");
    expect(signalSeverity("HIGH_RATING")).toBe("low");
    expect(signalSeverity("VALID_PHONE")).toBe("low");
  });
});

describe("buildSignalEvidence", () => {
  test("empty signal list → empty evidence array", () => {
    expect(buildSignalEvidence([], base)).toEqual([]);
  });

  test("evidence is specific and carries source/confidence/derivedAt", () => {
    const ctx: SignalContext = {
      ...base,
      rating: 2.8,
      reviewCount: 3,
      businessStatus: "OPERATIONAL",
    };
    const signals = deriveSignals(ctx);
    const evidence = buildSignalEvidence(signals, ctx, new Date("2026-08-15T12:00:00Z"));
    const weak = evidence.find((e) => e.signal === "WEAK_REPUTATION");
    expect(weak).toBeDefined();
    expect(weak!.evidence).toBe("nota 2.8 com 3 avaliações");
    expect(weak!.confidence).toBe(1);
    expect(weak!.source).toBe("google_places");
    expect(weak!.severity).toBe("high");
    expect(weak!.derivedAt).toBe("2026-08-15T12:00:00.000Z");
    const lowCount = evidence.find((e) => e.signal === "LOW_REVIEW_COUNT");
    expect(lowCount!.evidence).toBe("poucas avaliações (3)");
  });

  test("website-derived signals point at the website source", () => {
    const ctx: SignalContext = {
      ...base,
      hasWebsite: true,
      whatsappStatus: "verified",
      hasEmail: true,
    };
    const signals = deriveSignals(ctx);
    const evidence = buildSignalEvidence(signals, ctx);
    expect(evidence.find((e) => e.signal === "WHATSAPP_VALIDATED")!.source).toBe("website");
    expect(evidence.find((e) => e.signal === "HAS_EMAIL")!.source).toBe("website");
  });

  test("probable whatsapp is honest about not being confirmed", () => {
    const ctx: SignalContext = { ...base, whatsappStatus: "possible" };
    const evidence = buildSignalEvidence(deriveSignals(ctx), ctx);
    const wa = evidence.find((e) => e.signal === "WHATSAPP_AVAILABLE")!;
    expect(wa.evidence).toContain("não confirmado");
    expect(wa.confidence).toBeLessThan(1);
  });

  test("signal present without its supporting data → low confidence, generic evidence", () => {
    // Defensive: LOW_REVIEW_COUNT listed but reviewCount absent in the ctx.
    const evidence = buildSignalEvidence(["LOW_REVIEW_COUNT"], base);
    expect(evidence).toHaveLength(1);
    expect(evidence[0].confidence).toBe(0.3);
    expect(evidence[0].evidence).toBe("dado de origem não disponível");
  });

  test("no-website evidence never claims the site does not exist", () => {
    const evidence = buildSignalEvidence(deriveSignals(base), base);
    const noSite = evidence.find((e) => e.signal === "NO_WEBSITE")!;
    expect(noSite.evidence).toContain("identificado");
    expect(noSite.confidence).toBeLessThan(1); // Google may simply not have mapped it
  });
});
