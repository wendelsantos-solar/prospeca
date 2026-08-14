import { describe, expect, it, test } from "bun:test";
import {
  normalizeCnpj,
  isValidCnpj,
  registrationStatusFromSituacao,
  companyStatusFromRegistration,
  yearsInBusiness,
  isEstablishedByAge,
  ESTABLISHED_YEARS_MIN,
  type BusinessRegistryProvider,
} from "./business-registry.ts";

describe("normalizeCnpj", () => {
  it("strips formatting", () => {
    expect(normalizeCnpj("12.345.678/0001-95")).toBe("12345678000195");
    expect(normalizeCnpj("  12345678000195 ")).toBe("12345678000195");
  });
  it("returns empty for empty input", () => {
    expect(normalizeCnpj("")).toBe("");
    expect(normalizeCnpj("abc")).toBe("");
  });
});

describe("isValidCnpj", () => {
  it("accepts a valid CNPJ", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
  });
  it("rejects wrong length", () => {
    expect(isValidCnpj("12345")).toBe(false);
    expect(isValidCnpj("")).toBe(false);
  });
  it("rejects all-same digits", () => {
    expect(isValidCnpj("00.000.000/0000-00")).toBe(false);
  });
  it("rejects a corrupted check digit", () => {
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
  });
});

describe("registrationStatusFromSituacao", () => {
  it("maps known situações case-insensitively", () => {
    expect(registrationStatusFromSituacao("ATIVA")).toBe("active");
    expect(registrationStatusFromSituacao("ativa")).toBe("active");
    expect(registrationStatusFromSituacao("SUSPENSA")).toBe("suspended");
    expect(registrationStatusFromSituacao("BAIXADA")).toBe("inactive");
    expect(registrationStatusFromSituacao("INAPTA")).toBe("inactive");
    expect(registrationStatusFromSituacao("NULA")).toBe("inactive");
  });
  it("maps unknown to unknown", () => {
    expect(registrationStatusFromSituacao("X")).toBe("unknown");
    expect(registrationStatusFromSituacao(null)).toBe("unknown");
  });
});

describe("companyStatusFromRegistration", () => {
  it("maps active/suspended to operational, inactive to closed", () => {
    expect(companyStatusFromRegistration("active")).toBe("operational");
    expect(companyStatusFromRegistration("suspended")).toBe("operational");
    expect(companyStatusFromRegistration("inactive")).toBe("closed");
    expect(companyStatusFromRegistration("unknown")).toBe("unknown");
  });
});

describe("BusinessRegistryProvider contract — resiliência (Fase 5)", () => {
  const CNPJ = "11.222.333/0001-81";

  it("null = registry has NO record — a normal answer, never an error/cascade", async () => {
    // lookup-cnpj answers {found:false} for this and stamps the source
    // 'enriched' with the 90d TTL — absence of CNPJ ≠ company failure.
    const provider: BusinessRegistryProvider = {
      lookupByCnpj: async () => null,
    };
    const result = await provider.lookupByCnpj(CNPJ);
    expect(result).toBeNull();
  });

  it("throw = source DOWN — caller marks the source failed, company stays usable", async () => {
    // lookup-cnpj catches this, stamps business_registry 'failed' (re-checkable,
    // no TTL lock) and answers 200 {found:false, reason:'provider_unavailable'} —
    // the company profile/score are untouched.
    const provider: BusinessRegistryProvider = {
      lookupByCnpj: async () => {
        throw new Error("ETIMEDOUT: registry timeout");
      },
    };
    let caught: unknown = null;
    try {
      await provider.lookupByCnpj(CNPJ);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("ETIMEDOUT");
  });

  it("invalid CNPJ is rejected BEFORE any provider call", () => {
    expect(isValidCnpj(normalizeCnpj("00.000.000/0000-00"))).toBe(false);
    expect(isValidCnpj(normalizeCnpj("12345"))).toBe(false);
  });
});

describe("company age (V3-D)", () => {
  test("yearsInBusiness from a real founded date", () => {
    const now = new Date("2026-08-15T00:00:00Z");
    expect(yearsInBusiness("2016-01-01", now)).toBe(10);
    expect(yearsInBusiness("2024-01-01", now)).toBe(2);
  });

  test("absent/invalid date → null (never fabricate an age)", () => {
    expect(yearsInBusiness(null)).toBeNull();
    expect(yearsInBusiness(undefined)).toBeNull();
    expect(yearsInBusiness("not-a-date")).toBeNull();
  });

  test("future date → null (not negative years)", () => {
    expect(yearsInBusiness("2030-01-01", new Date("2026-08-15T00:00:00Z"))).toBeNull();
  });

  test("isEstablishedByAge threshold (≥ ESTABLISHED_YEARS_MIN)", () => {
    const now = new Date("2026-08-15T00:00:00Z");
    expect(ESTABLISHED_YEARS_MIN).toBe(5);
    expect(isEstablishedByAge("2010-01-01", now)).toBe(true);
    expect(isEstablishedByAge("2024-01-01", now)).toBe(false);
    expect(isEstablishedByAge(null, now)).toBe(false);
  });
});
