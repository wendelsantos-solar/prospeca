import type { Lead } from "@/types";
import { formatBRL, formatDate } from "./format";

const HEADERS = [
  "Empresa",
  "Categoria",
  "Descrição",
  "Endereço",
  "Bairro",
  "Cidade",
  "Estado",
  "Telefone",
  "WhatsApp",
  "E-mail",
  "Instagram",
  "Website",
  "Possui site",
  "Nota",
  "Avaliações",
  "Distância (km)",
  "Temperatura",
  "Score",
  "Estágio",
  "Valor estimado",
  "Última interação",
  "Descoberto em",
];

function toRow(l: Lead) {
  return [
    l.companyName,
    l.category,
    l.description ?? "",
    l.address,
    l.neighborhood ?? "",
    l.city,
    l.state,
    l.phone ?? "",
    l.whatsapp ?? "",
    l.email ?? "",
    l.instagram ?? "",
    l.website ?? "",
    l.hasWebsite ? "Sim" : "Não",
    l.rating ?? "",
    l.reviewCount ?? "",
    l.distanceKm,
    l.temperature,
    l.score,
    l.stage,
    l.estimatedValue != null ? formatBRL(l.estimatedValue) : "",
    l.lastInteractionAt ? formatDate(l.lastInteractionAt) : "",
    formatDate(l.discoveredAt),
  ];
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const csvEscape = (v: unknown) => {
  const s = String(v ?? "");
  return /[";,\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function exportCSV(leads: Lead[]) {
  const rows = [HEADERS.join(","), ...leads.map((l) => toRow(l).map(csvEscape).join(","))];
  download(
    "\uFEFF" + rows.join("\n"),
    `radar-local-leads-${Date.now()}.csv`,
    "text/csv;charset=utf-8;",
  );
}

export function exportExcel(leads: Lead[]) {
  // SpreadsheetML 2003 XML — abre no Excel como .xls, sem dependências.
  const xmlEscape = (v: unknown) =>
    String(v ?? "").replace(
      /[<>&'"]/g,
      (c) =>
        ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] as string,
    );
  const cells = (row: (string | number)[]) =>
    row
      .map(
        (v) =>
          `<Cell><Data ss:Type="${typeof v === "number" ? "Number" : "String"}">${xmlEscape(v)}</Data></Cell>`,
      )
      .join("");
  const rowsXml = [
    `<Row>${HEADERS.map((h) => `<Cell><Data ss:Type="String">${xmlEscape(h)}</Data></Cell>`).join("")}</Row>`,
    ...leads.map((l) => `<Row>${cells(toRow(l) as (string | number)[])}</Row>`),
  ].join("");
  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Leads"><Table>${rowsXml}</Table></Worksheet></Workbook>`;
  download(xml, `radar-local-leads-${Date.now()}.xls`, "application/vnd.ms-excel");
}
