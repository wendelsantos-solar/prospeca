import { describe, expect, test } from "bun:test";
import {
  hasRealWebsite,
  normalizeCompanyName,
  normalizeDomain,
  normalizePhone,
  waMeLink,
  whatsappStatusFor,
} from "./normalize";

describe("normalizePhone", () => {
  test("mobile with DDI", () => {
    const p = normalizePhone("+55 (51) 99876-5432");
    expect(p.isValid).toBe(true);
    expect(p.type).toBe("mobile");
    expect(p.e164).toBe("+5551998765432");
    expect(p.areaCode).toBe("51");
  });
  test("landline", () => {
    const p = normalizePhone("5133214567");
    expect(p.isValid).toBe(true);
    expect(p.type).toBe("landline");
  });
  test("invalid DDD", () => {
    expect(normalizePhone("0099999999").isValid).toBe(false);
  });
  test("wrong length", () => {
    expect(normalizePhone("123").isValid).toBe(false);
  });
});

describe("whatsappStatusFor", () => {
  test("mobile -> possible", () => {
    expect(whatsappStatusFor(normalizePhone("51998765432"))).toBe("possible");
  });
  test("landline -> unknown", () => {
    expect(whatsappStatusFor(normalizePhone("5133214567"))).toBe("unknown");
  });
  test("invalid -> invalid", () => {
    expect(whatsappStatusFor(normalizePhone("1"))).toBe("invalid");
  });
});

describe("waMeLink", () => {
  test("builds link for valid mobile", () => {
    expect(waMeLink("51998765432")).toBe("https://wa.me/5551998765432");
  });
  test("null for invalid", () => {
    expect(waMeLink("abc")).toBeNull();
  });
});

describe("normalizeDomain", () => {
  test.each([
    ["https://www.Example.com/x", "example.com"],
    ["example.com", "example.com"],
    ["http://sub.Foo.COM.BR", "sub.foo.com.br"],
    ["not a url", null],
    ["", null],
  ])("%s -> %p", (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected as any);
  });
});

describe("hasRealWebsite", () => {
  test("real site", () => {
    expect(hasRealWebsite("https://clinicasaojose.com.br")).toBe(true);
  });
  test.each(["https://instagram.com/foo", "https://www.facebook.com/bar", "https://wa.me/55519"])(
    "social %s is not a real site",
    (url) => {
      expect(hasRealWebsite(url)).toBe(false);
    },
  );
  test("empty", () => {
    expect(hasRealWebsite(null)).toBe(false);
  });
});

describe("normalizeCompanyName", () => {
  test("strips accents, suffixes, punctuation", () => {
    expect(normalizeCompanyName("CLÍNICA SÃO JOSÉ LTDA")).toBe("clinica sao jose");
    expect(normalizeCompanyName("Clinica São José")).toBe("clinica sao jose");
    expect(normalizeCompanyName("Clínica São José ME")).toBe("clinica sao jose");
  });
});
