import { expect, test } from "bun:test";
import { withSecurityHeaders } from "./security-headers";

test("withSecurityHeaders preserva a resposta e adiciona a política base", async () => {
  const response = withSecurityHeaders(
    new Request("https://prospeca.com.br/precos"),
    new Response("ok", { status: 201, headers: { "x-request-id": "req-1" } }),
  );

  expect(response.status).toBe(201);
  expect(await response.text()).toBe("ok");
  expect(response.headers.get("x-request-id")).toBe("req-1");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
  expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
  expect(response.headers.get("strict-transport-security")).toContain("max-age=31536000");
});

test("withSecurityHeaders não envia HSTS em desenvolvimento HTTP", () => {
  const response = withSecurityHeaders(new Request("http://127.0.0.1:8080/"), new Response("ok"));

  expect(response.headers.has("strict-transport-security")).toBe(false);
});
