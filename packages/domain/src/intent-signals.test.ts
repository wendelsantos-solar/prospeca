import { describe, it, expect } from "bun:test";
import { deriveIntentSignals } from "./intent-signals";

describe("deriveIntentSignals", () => {
  it("returns empty when nothing applies", () => {
    const s = deriveIntentSignals({ hasWebsite: true, rating: 4.5, instagram: "@x", whatsapp: "51" });
    expect(s).toEqual([]);
  });

  it("flags critical reputation below 3.0", () => {
    const s = deriveIntentSignals({ hasWebsite: true, rating: 2.4, reviewCount: 30 });
    expect(s.some((x) => x.signal === "CRITICAL_REPUTATION")).toBe(true);
  });

  it("does NOT flag rating 3.5 as critical", () => {
    const s = deriveIntentSignals({ hasWebsite: true, rating: 3.5 });
    expect(s.some((x) => x.signal === "CRITICAL_REPUTATION")).toBe(false);
  });

  it("flags no online presence when every channel is absent", () => {
    const s = deriveIntentSignals({ hasWebsite: false });
    expect(s.some((x) => x.signal === "NO_ONLINE_PRESENCE")).toBe(true);
  });

  it("does NOT flag no online presence when instagram exists", () => {
    const s = deriveIntentSignals({ hasWebsite: false, instagram: "@x" });
    expect(s.some((x) => x.signal === "NO_ONLINE_PRESENCE")).toBe(false);
  });

  it("flags site unreachable only when enrichment failed with a website", () => {
    const s = deriveIntentSignals({ hasWebsite: true, enrichmentState: "failed" });
    expect(s.some((x) => x.signal === "SITE_UNREACHABLE")).toBe(true);
  });

  it("does not fabricate urgency from absent data", () => {
    const s = deriveIntentSignals({ hasWebsite: true, rating: null });
    expect(s).toEqual([]);
  });
});
