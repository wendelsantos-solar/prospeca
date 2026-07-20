import { describe, expect, test } from "bun:test";
import { assertSafeUrl, isBlockedHost, isPrivateIpv4, isPrivateIpv6, SsrfBlockedError } from "./ssrf";

describe("isPrivateIpv4", () => {
  test.each([
    ["127.0.0.1", true],
    ["10.1.2.3", true],
    ["172.16.0.1", true],
    ["172.31.255.255", true],
    ["172.32.0.1", false],
    ["192.168.1.1", true],
    ["169.254.169.254", true], // cloud metadata
    ["100.64.0.1", true],
    ["8.8.8.8", false],
    ["1.1.1.1", false],
  ])("%s -> %p", (ip, expected) => {
    expect(isPrivateIpv4(ip)).toBe(expected);
  });
});

describe("isPrivateIpv6", () => {
  test.each([
    ["::1", true],
    ["fc00::1", true],
    ["fd12::1", true],
    ["fe80::1", true],
    ["2606:4700:4700::1111", false],
  ])("%s -> %p", (ip, expected) => {
    expect(isPrivateIpv6(ip)).toBe(expected);
  });
});

describe("isBlockedHost", () => {
  test.each(["localhost", "foo.localhost", "svc.internal", "printer.local", "127.0.0.1", "[::1]"])(
    "blocks %s",
    (h) => {
      expect(isBlockedHost(h.replace(/^\[|\]$/g, ""))).toBe(true);
    },
  );
  test("allows public host", () => {
    expect(isBlockedHost("overpass-api.de")).toBe(false);
  });
});

describe("assertSafeUrl", () => {
  test("passes public https", () => {
    expect(assertSafeUrl("https://nominatim.openstreetmap.org/search").hostname).toBe(
      "nominatim.openstreetmap.org",
    );
  });
  test.each([
    "http://169.254.169.254/latest/meta-data/",
    "http://localhost:8080/admin",
    "http://10.0.0.5/",
    "https://user:pass@example.com/",
    "file:///etc/passwd",
    "gopher://evil",
  ])("blocks %s", (u) => {
    expect(() => assertSafeUrl(u)).toThrow(SsrfBlockedError);
  });
});
