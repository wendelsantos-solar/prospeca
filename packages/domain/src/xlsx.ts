// Minimal XLSX generator — pure, dependency-free (ZIP STORE + hand-built XML
// parts + CRC32). Chosen over SheetJS deliberately: the export only needs a
// flat table (one sheet), and a 150-line generator avoids a ~1MB dependency
// inside the edge bundle while remaining fully testable in the pure domain.
//
// Safety: the same formula-injection guard as the CSV path — string cells
// starting with = + - @ tab CR get a leading apostrophe so Excel never
// evaluates user-controlled content.

export interface XlsxSheet {
  name: string;
  /** Rows of cells: string | number | boolean | null/undefined (empty). */
  rows: Array<Array<string | number | boolean | null | undefined>>;
}

// ── CRC32 (IEEE) ────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const encoder = new TextEncoder();

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Formula-injection guard (same rule as the CSV sanitizer). */
function safeCellText(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function columnName(index: number): string {
  let n = index;
  let name = "";
  while (n >= 0) {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  }
  return name;
}

function sheetXml(sheet: XlsxSheet): string {
  const rows = sheet.rows
    .map((cells, r) => {
      const cellsXml = cells
        .map((cell, c) => {
          if (cell == null || cell === "") return "";
          const ref = `${columnName(c)}${r + 1}`;
          if (typeof cell === "number") {
            return `<c r="${ref}"><v>${cell}</v></c>`;
          }
          if (typeof cell === "boolean") {
            return `<c r="${ref}" t="b"><v>${cell ? 1 : 0}</v></c>`;
          }
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(
            safeCellText(String(cell)),
          )}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${cellsXml}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`;
}

// ── ZIP (STORE, no compression) ─────────────────────────────────────────────

function zipEntry(name: string, bytes: Uint8Array): { local: Uint8Array; central: Uint8Array } {
  const nameBytes = encoder.encode(name);
  const crc = crc32(bytes);
  const local = new Uint8Array(30 + nameBytes.length + bytes.length);
  const dv = new DataView(local.buffer);
  dv.setUint32(0, 0x04034b50, true);
  dv.setUint16(4, 20, true); // version needed
  dv.setUint16(6, 0, true); // flags
  dv.setUint16(8, 0, true); // method (store)
  dv.setUint16(10, 0, true); // time
  dv.setUint16(12, 0, true); // date
  dv.setUint32(14, crc, true);
  dv.setUint32(18, bytes.length, true); // compressed size
  dv.setUint32(22, bytes.length, true); // uncompressed size
  dv.setUint16(26, nameBytes.length, true);
  dv.setUint16(28, 0, true); // extra len
  local.set(nameBytes, 30);
  local.set(bytes, 30 + nameBytes.length);

  const central = new Uint8Array(46 + nameBytes.length);
  const cd = new DataView(central.buffer);
  cd.setUint32(0, 0x02014b50, true);
  cd.setUint16(4, 20, true); // version made by
  cd.setUint16(6, 20, true); // version needed
  cd.setUint16(8, 0, true);
  cd.setUint16(10, 0, true); // method
  cd.setUint16(12, 0, true);
  cd.setUint16(14, 0, true);
  cd.setUint32(16, crc, true);
  cd.setUint32(20, bytes.length, true);
  cd.setUint32(24, bytes.length, true);
  cd.setUint16(28, nameBytes.length, true);
  cd.setUint16(30, 0, true); // extra
  cd.setUint16(32, 0, true); // comment
  cd.setUint16(34, 0, true); // disk
  cd.setUint16(36, 0, true); // internal attrs
  cd.setUint32(38, 0, true); // external attrs
  cd.setUint32(42, 0, true); // local header offset (patched by caller)
  central.set(nameBytes, 46);
  return { local, central };
}

/** Build a single-sheet XLSX workbook as raw bytes (downloadable blob). */
export function buildXlsx(sheets: XlsxSheet[]): Uint8Array {
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets
    .map((s, i) => `<sheet name="${xmlEscape(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join("")}</sheets></workbook>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
    )
    .join(
      "",
    )}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${sheets
    .map(
      (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join(
      "",
    )}<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="1"><xf/></cellXfs></styleSheet>`;

  const entries: Array<{ name: string; bytes: Uint8Array }> = [
    { name: "[Content_Types].xml", bytes: encoder.encode(contentTypes) },
    { name: "_rels/.rels", bytes: encoder.encode(rootRels) },
    { name: "xl/workbook.xml", bytes: encoder.encode(workbook) },
    { name: "xl/_rels/workbook.xml.rels", bytes: encoder.encode(rels) },
    { name: "xl/styles.xml", bytes: encoder.encode(styles) },
  ];
  sheets.forEach((sheet, i) => {
    entries.push({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      bytes: encoder.encode(sheetXml(sheet)),
    });
  });

  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const { local, central } = zipEntry(entry.name, entry.bytes);
    // patch the local-header offset in the central record
    new DataView(central.buffer).setUint32(42, offset, true);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const centralSize = centrals.reduce((s, c) => s + c.length, 0);

  const end = new Uint8Array(22);
  const ed = new DataView(end.buffer);
  ed.setUint32(0, 0x06054b50, true);
  ed.setUint16(4, 0, true);
  ed.setUint16(6, 0, true);
  ed.setUint16(8, entries.length, true);
  ed.setUint16(10, entries.length, true);
  ed.setUint32(12, centralSize, true);
  ed.setUint32(16, offset, true);
  ed.setUint16(20, 0, true);

  const total = offset + centralSize + end.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const l of locals) {
    out.set(l, pos);
    pos += l.length;
  }
  for (const c of centrals) {
    out.set(c, pos);
    pos += c.length;
  }
  out.set(end, pos);
  return out;
}
