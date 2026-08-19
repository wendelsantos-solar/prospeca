import { describe, expect, test } from "bun:test";
import { buildXlsx } from "./xlsx";

const decoder = new TextDecoder();

describe("buildXlsx (minimal generator)", () => {
  test("produces a ZIP (PK magic) with the sheet entry", () => {
    const bytes = buildXlsx([
      {
        name: "Leads",
        rows: [
          ["a", "b"],
          [1, 2],
        ],
      },
    ]);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    const text = decoder.decode(bytes);
    expect(text).toContain("xl/worksheets/sheet1.xml");
    expect(text).toContain("xl/workbook.xml");
  });

  test("sheet XML contains escaped cell values", () => {
    const bytes = buildXlsx([{ name: "Leads", rows: [["Empresa <A&B>", "x"]] }]);
    const text = decoder.decode(bytes);
    expect(text).toContain("Empresa &lt;A&amp;B&gt;");
  });

  test("numbers stay numeric, strings with formula chars get the injection guard", () => {
    const bytes = buildXlsx([{ name: "S", rows: [[42, "=cmd()", "+1", "-x", "@ref", "\tx"]] }]);
    const text = decoder.decode(bytes);
    expect(text).toContain("<v>42</v>");
    expect(text).toContain("'=cmd()");
    expect(text).toContain("'+1");
    expect(text).toContain("'-x");
    expect(text).toContain("'@ref");
  });

  test("empty/null cells are skipped", () => {
    const bytes = buildXlsx([{ name: "S", rows: [["a", null, undefined, ""]] }]);
    const text = decoder.decode(bytes);
    const rowXml = text.slice(text.indexOf("<row"), text.indexOf("</row>") + 6);
    // one cell only (col A)
    expect(rowXml.match(/<c /g)).toHaveLength(1);
  });

  test("multiple rows keep row indexes", () => {
    const bytes = buildXlsx([{ name: "S", rows: [["h"], ["r1"], ["r2"]] }]);
    const text = decoder.decode(bytes);
    expect(text).toContain('<row r="1">');
    expect(text).toContain('<row r="3">');
  });
});
