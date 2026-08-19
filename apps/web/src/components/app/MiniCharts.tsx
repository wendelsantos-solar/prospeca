import { useEffect, useRef, useState } from "react";
import { niceCeil, makeTicks } from "@/lib/chart-scale";

/**
 * MiniCharts — lightweight SVG charts replacing Recharts (99 kB gzip → 0).
 * Renders crisp SVG at the measured container size (ResizeObserver), with a
 * custom tooltip. No external dependency, no scaling artifacts.
 */

export interface MiniDatum {
  label: string;
  value: number;
}

// ── Measure hook (SSR-safe) ────────────────────────────────────────────────

function useMeasure<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setSize({ width: r.width, height: r.height });
    });
    ro.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

// ── Shared tooltip ─────────────────────────────────────────────────────────

function ChartTip({
  x,
  y,
  visible,
  children,
}: {
  x: number;
  y: number;
  visible: boolean;
  children: React.ReactNode;
}) {
  if (!visible) return null;
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-popover px-2.5 py-1.5 text-[12px] shadow-popover"
      style={{ left: x, top: y - 8 }}
    >
      {children}
    </div>
  );
}

function formatTick(v: number): string {
  if (v >= 1000) return `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
  return String(v);
}

type FormatFn = (v: number) => string;

interface BarProps {
  data: MiniDatum[];
  color: string;
  horizontal?: boolean;
  formatValue?: FormatFn;
  formatLabel?: (label: string) => string;
  height?: number;
}

function defaultFormat(v: number) {
  return v.toLocaleString("pt-BR");
}

// ── Bar chart (vertical + horizontal) ──────────────────────────────────────

export function MiniBarChart({
  data,
  color,
  horizontal = false,
  formatValue = defaultFormat,
  formatLabel,
  height = 224,
}: BarProps) {
  const [ref, size] = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);

  const W = Math.max(size.width, 1);
  const H = size.height || height;
  const pad = horizontal ? { l: 118, r: 28, t: 8, b: 8 } : { l: 40, r: 12, t: 12, b: 26 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const max = niceCeil(Math.max(...data.map((d) => d.value), 1));
  const ticks = makeTicks(max, horizontal ? 4 : 4);
  const label = (d: MiniDatum) => (formatLabel ? formatLabel(d.label) : d.label);
  const plotW2 = plotW;

  if (size.width === 0) return <div ref={ref} className="h-full w-full" />;

  return (
    <div ref={ref} className="relative h-full w-full">
      <svg width={W} height={H} role="img">
        {ticks.map((t, i) => {
          const x = horizontal ? pad.l : pad.l + (t / max) * plotW2;
          const y = horizontal
            ? pad.t + (i / (ticks.length - 1)) * plotH
            : pad.t + plotH - (t / max) * plotH;
          return (
            <g key={i}>
              <line
                x1={horizontal ? pad.l : x}
                y1={horizontal ? y : pad.t}
                x2={horizontal ? pad.l + plotW2 : x}
                y2={horizontal ? y : pad.t + plotH}
                stroke="var(--color-border)"
                strokeDasharray="3 3"
              />
              <text
                x={horizontal ? pad.l - 8 : x}
                y={horizontal ? y + 4 : pad.t + plotH + 16}
                textAnchor={horizontal ? "end" : "middle"}
                fontSize={11}
                fill="var(--color-muted-foreground)"
              >
                {formatTick(t)}
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          if (horizontal) {
            const barH = Math.max(plotH / data.length / 1.6, 6);
            const y = pad.t + (i * plotH) / data.length + (plotH / data.length - barH) / 2;
            const w = (d.value / max) * plotW2;
            return (
              <g
                key={i}
                onMouseEnter={(e) => {
                  const r = (e.currentTarget as SVGGElement).getBoundingClientRect();
                  setHover({ i, x: pad.l + w, y: y });
                }}
                onMouseLeave={() => setHover(null)}
              >
                <text
                  x={pad.l - 10}
                  y={y + barH / 2 + 4}
                  textAnchor="end"
                  fontSize={11}
                  fill="var(--color-foreground)"
                >
                  {label(d)}
                </text>
                <rect
                  x={pad.l}
                  y={y}
                  width={Math.max(w, 0)}
                  height={barH}
                  rx={4}
                  fill={color}
                  opacity={hover?.i === i ? 0.8 : 1}
                />
              </g>
            );
          }
          const bw = plotW2 / data.length;
          const barW = Math.max(bw * 0.55, 3);
          const x = pad.l + i * bw + (bw - barW) / 2;
          const h = (d.value / max) * plotH;
          const y = pad.t + plotH - h;
          return (
            <g
              key={i}
              onMouseEnter={() => setHover({ i, x: x + barW / 2, y })}
              onMouseLeave={() => setHover(null)}
            >
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(h, 0)}
                rx={5}
                fill={color}
                opacity={hover?.i === i ? 0.8 : 1}
              />
              <text
                x={x + barW / 2}
                y={pad.t + plotH + 16}
                textAnchor="middle"
                fontSize={11}
                fill="var(--color-muted-foreground)"
              >
                {label(d).length > 12 ? label(d).slice(0, 11) + "…" : label(d)}
              </text>
            </g>
          );
        })}
      </svg>

      {hover != null && data[hover.i] && (
        <ChartTip x={hover.x} y={hover.y} visible>
          <span className="font-medium">{label(data[hover.i])}</span>{" "}
          <span className="text-muted-foreground">{formatValue(data[hover.i].value)}</span>
        </ChartTip>
      )}
    </div>
  );
}

// ── Line / area chart ──────────────────────────────────────────────────────

export function MiniLineChart({
  data,
  color,
  area = false,
  formatValue = defaultFormat,
  height = 224,
}: {
  data: MiniDatum[];
  color: string;
  area?: boolean;
  formatValue?: FormatFn;
  height?: number;
}) {
  const [ref, size] = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);

  const W = Math.max(size.width, 1);
  const H = size.height || height;
  const pad = { l: 40, r: 12, t: 12, b: 26 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const max = niceCeil(Math.max(...data.map((d) => d.value), 1));
  const ticks = makeTicks(max, 4);

  if (size.width === 0) return <div ref={ref} className="h-full w-full" />;

  const xFor = (i: number) => (data.length <= 1 ? pad.l : pad.l + (i / (data.length - 1)) * plotW);
  const yFor = (v: number) => pad.t + plotH - (v / max) * plotH;
  const points = data.map((d, i) => `${xFor(i)},${yFor(d.value)}`).join(" ");
  const areaPath = data.length
    ? `M ${xFor(0)},${pad.t + plotH} L ${points.replace(/ /g, " L ")} L ${xFor(data.length - 1)},${pad.t + plotH} Z`
    : "";
  const gradId = `mc-grad-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <div ref={ref} className="relative h-full w-full">
      <svg width={W} height={H} role="img">
        {area && (
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
        )}
        {ticks.map((t, i) => {
          const y = pad.t + plotH - (t / max) * plotH;
          return (
            <g key={i}>
              <line
                x1={pad.l}
                y1={y}
                x2={pad.l + plotW}
                y2={y}
                stroke="var(--color-border)"
                strokeDasharray="3 3"
              />
              <text
                x={pad.l - 8}
                y={y + 4}
                textAnchor="end"
                fontSize={11}
                fill="var(--color-muted-foreground)"
              >
                {formatTick(t)}
              </text>
            </g>
          );
        })}
        {area && <path d={areaPath} fill={`url(#${gradId})`} />}
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {data.map((d, i) => (
          <circle
            key={i}
            cx={xFor(i)}
            cy={yFor(d.value)}
            r={hover?.i === i ? 5 : 3}
            fill="var(--color-surface)"
            stroke={color}
            strokeWidth={2}
            onMouseEnter={() => setHover({ i, x: xFor(i), y: yFor(d.value) })}
            onMouseLeave={() => setHover(null)}
          />
        ))}
        {/* x-axis labels: show a subset to avoid crowding */}
        {data.map((d, i) => {
          const step = Math.ceil(data.length / 7);
          if (i % step !== 0 && i !== data.length - 1) return null;
          return (
            <text
              key={i}
              x={xFor(i)}
              y={pad.t + plotH + 16}
              textAnchor="middle"
              fontSize={11}
              fill="var(--color-muted-foreground)"
            >
              {d.label}
            </text>
          );
        })}
      </svg>

      {hover != null && data[hover.i] && (
        <ChartTip x={hover.x} y={hover.y} visible>
          <span className="text-muted-foreground">{data[hover.i].label}</span>{" "}
          <span className="font-medium">{formatValue(data[hover.i].value)}</span>
        </ChartTip>
      )}
    </div>
  );
}

// ── Donut chart with legend ────────────────────────────────────────────────

export function MiniDonutChart({
  data,
  colors,
  height = 224,
}: {
  data: MiniDatum[];
  colors: string[];
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const size = Math.min(height, 224);
  const c = size / 2;
  const r = c - 22;
  const stroke = 22;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const segments = data.map((d, i) => {
    const frac = d.value / total;
    const len = Math.max(frac * circumference, d.value > 0 ? 1.5 : 0);
    const seg = { ...d, i, color: colors[i % colors.length], len, offset };
    offset += frac * circumference;
    return seg;
  });

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 sm:flex-row sm:gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} role="img">
          <g transform={`rotate(-90 ${c} ${c})`}>
            {segments.map((s) => (
              <circle
                key={s.i}
                cx={c}
                cy={c}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={stroke}
                strokeDasharray={`${s.len} ${circumference - s.len}`}
                strokeDashoffset={-s.offset}
                strokeLinecap="butt"
                opacity={hover == null || hover === s.i ? 1 : 0.35}
                onMouseEnter={() => setHover(s.i)}
                onMouseLeave={() => setHover(null)}
              />
            ))}
          </g>
          <text
            x={c}
            y={c}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={26}
            fontWeight={700}
            fill="var(--color-foreground)"
          >
            {total.toLocaleString("pt-BR")}
          </text>
        </svg>
      </div>
      <div className="flex flex-row flex-wrap gap-x-3 gap-y-1 sm:flex-col">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[11px]">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: colors[i % colors.length] }}
            />
            <span className="text-muted-foreground">{d.label}</span>
            <span className="font-medium tabular-nums">{d.value.toLocaleString("pt-BR")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
