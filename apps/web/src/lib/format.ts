const brlFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const numberFormatter = new Intl.NumberFormat("pt-BR");
const decimalFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
});

export const formatBRL = (v?: number | null) => (v == null ? "—" : brlFormatter.format(v));
export const formatNumber = (v?: number | null) => (v == null ? "—" : numberFormatter.format(v));
export const formatDecimal = (v?: number | null) => (v == null ? "—" : decimalFormatter.format(v));
export const formatPercent = (v?: number | null) => (v == null ? "—" : percentFormatter.format(v));
export const formatDistance = (km?: number | null) =>
  km == null ? "—" : km < 1 ? `${Math.round(km * 1000)} m` : `${decimalFormatter.format(km)} km`;

export const formatDate = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR");
};

export const formatDateTime = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
};

export const formatRelative = (iso?: string | null) => {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days} d`;
  return formatDate(iso);
};

export const digitsOnly = (v?: string) => (v ?? "").replace(/\D/g, "");
