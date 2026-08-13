import { describe, expect, it } from "bun:test";
import {
  normalizeCnpj,
  isValidCnpj,
  registrationStatusFromSituacao,
  companyStatusFromRegistration,
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
