import type { DiscoveryResult } from "@/repositories/types";
import { buildXlsx } from "@leads/domain";
import { categoryLabel } from "./category";
import { whatsappDisplay } from "./whatsapp";

const DISCOVERY_HEADERS = [
  "Empresa",
  "Categoria",
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
  "No funil",
];

/** CSV das empresas descobertas (não são leads ainda). */
export function exportDiscoveryCSV(results: DiscoveryResult[]) {
  const row = (r: DiscoveryResult) => [
    r.name,
    categoryLabel(r.category),
    r.phone ?? "",
    whatsappDisplay(r.whatsapp, r.phone)?.value ?? "",
    r.email ?? "",
    r.instagram ?? "",
    r.website ?? "",
    r.hasWebsite ? "Sim" : "Não",
    r.rating ?? "",
    r.reviewCount ?? "",
    // Célula VAZIA quando não há coordenada — "0,0" numa planilha seria lido
    // como "está no centro exato da busca".
    r.distanceKm != null ? r.distanceKm.toFixed(1) : "",
    r.temperature,
    r.score,
    r.importedLeadId != null ? "Sim" : "Não",
  ];
  const rows = [
    DISCOVERY_HEADERS.join(","),
    ...results.map((r) => row(r).map(csvEscape).join(",")),
  ];
  download(
    "﻿" + rows.join("\n"),
    `radar-local-descoberta-${Date.now()}.csv`,
    "text/csv;charset=utf-8;",
  );
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

// ── V3-F: seleção de campos + formatos (CSV/XLSX) ──────────────────────────

export type DiscoveryExportFormat = "csv" | "xlsx";

export interface DiscoveryExportFieldDef {
  key: string;
  label: string;
  group: "básicos" | "contato" | "score";
  value: (r: DiscoveryResult) => string | number | boolean | null;
}

/** Campos exportáveis da descoberta — só o que existe no DiscoveryResult
 * (honestidade: nada é inventado; campos ausentes saem vazios). */
export const DISCOVERY_EXPORT_FIELDS: DiscoveryExportFieldDef[] = [
  { key: "name", label: "Empresa", group: "básicos", value: (r) => r.name },
  {
    key: "category",
    label: "Categoria",
    group: "básicos",
    value: (r) => categoryLabel(r.category),
  },
  { key: "neighborhood", label: "Bairro", group: "básicos", value: (r) => r.neighborhood ?? "" },
  { key: "city", label: "Cidade", group: "básicos", value: (r) => r.city ?? "" },
  { key: "state", label: "UF", group: "básicos", value: (r) => r.state ?? "" },
  {
    key: "distance_km",
    label: "Distância (km)",
    group: "básicos",
    value: (r) => (r.distanceKm != null ? r.distanceKm.toFixed(1) : ""),
  },
  { key: "phone", label: "Telefone", group: "contato", value: (r) => r.phone ?? "" },
  {
    key: "whatsapp",
    label: "WhatsApp",
    group: "contato",
    value: (r) => whatsappDisplay(r.whatsapp, r.phone)?.value ?? "",
  },
  { key: "email", label: "E-mail", group: "contato", value: (r) => r.email ?? "" },
  { key: "instagram", label: "Instagram", group: "contato", value: (r) => r.instagram ?? "" },
  { key: "website", label: "Website", group: "contato", value: (r) => r.website ?? "" },
  {
    key: "has_website",
    label: "Possui site",
    group: "contato",
    value: (r) => (r.hasWebsite ? "Sim" : "Não"),
  },
  { key: "rating", label: "Nota", group: "score", value: (r) => r.rating ?? "" },
  { key: "review_count", label: "Avaliações", group: "score", value: (r) => r.reviewCount ?? "" },
  { key: "score", label: "Score", group: "score", value: (r) => r.score },
  { key: "temperature", label: "Temperatura", group: "score", value: (r) => r.temperature },
  {
    key: "in_funnel",
    label: "No funil",
    group: "score",
    value: (r) => (r.importedLeadId != null ? "Sim" : "Não"),
  },
];

export const DEFAULT_DISCOVERY_EXPORT_KEYS = DISCOVERY_EXPORT_FIELDS.map((f) => f.key);

/** Exporta as empresas descobertas em CSV ou XLSX, com seleção de campos. */
export function exportDiscoveryFile(
  results: DiscoveryResult[],
  opts: { format: DiscoveryExportFormat; fields: string[] },
) {
  const defs = DISCOVERY_EXPORT_FIELDS.filter((f) => opts.fields.includes(f.key));
  const rows: Array<Array<string | number | boolean | null>> = results.map((r) =>
    defs.map((f) => f.value(r) ?? ""),
  );
  const filename = `radar-local-descoberta-${Date.now()}`;
  if (opts.format === "xlsx") {
    const bytes = buildXlsx([{ name: "Descoberta", rows: [defs.map((d) => d.label), ...rows] }]);
    const blob = new Blob([bytes.slice().buffer as ArrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return;
  }
  const csv =
    "﻿" +
    [defs.map((d) => d.label).join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\n");
  download(csv, `${filename}.csv`, "text/csv;charset=utf-8;");
}
