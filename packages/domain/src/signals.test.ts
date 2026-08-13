import { describe, expect, test } from "bun:test";
import { deriveSignals, hasSignal, type SignalContext } from "./signals";

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
