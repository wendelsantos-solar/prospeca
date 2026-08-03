import { describe, expect, test } from "bun:test";
import { escapeHtml } from "./html.ts";

describe("escapeHtml", () => {
  test("escapes markup and quoted attributes in untrusted email content", () => {
    expect(escapeHtml(`<script data-x="a&b">alert('x')</script>`)).toBe(
      "&lt;script data-x=&quot;a&amp;b&quot;&gt;alert(&#039;x&#039;)&lt;/script&gt;",
    );
  });

  test("keeps ordinary Portuguese copy unchanged", () => {
    expect(escapeHtml("Quero prospectar empresas em São Paulo.")).toBe(
      "Quero prospectar empresas em São Paulo.",
    );
  });
});
