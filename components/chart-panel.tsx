"use client";

import { useEffect, useState, useCallback, useId } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { Trash2, AlertCircle } from "lucide-react";
import type { ChartType } from "@/lib/panel-presets";
import { useTimeRange } from "@/components/time-range";

type Point = { t: number; [series: string]: number };

type PrometheusRangeResponse = {
  data?: {
    result: Array<{
      metric: Record<string, string>;
      values?: Array<[number, string]>;
    }>;
  };
  error?: string;
};

const SERIES_PALETTE = [
  "#176b4d",
  "#2f6fb0",
  "#6a4fb0",
  "#d28a24",
  "#b9473e",
  "#c04d8a",
  "#2a8a66",
  "#4a7fa8",
];

function seriesLabel(metric: Record<string, string>) {
  const entries = Object.entries(metric).filter(([key]) => key !== "__name__");
  if (entries.length === 0) return "değer";
  return entries.map(([, v]) => v).join(" · ");
}

function toChartData(result: PrometheusRangeResponse): { data: Point[]; keys: string[] } {
  const series = result.data?.result ?? [];
  const keys: string[] = [];
  const byTime = new Map<number, Point>();

  for (const s of series) {
    const key = seriesLabel(s.metric);
    keys.push(key);
    for (const [t, v] of s.values ?? []) {
      const point = byTime.get(t) ?? { t: t * 1000 };
      point[key] = Number(v);
      byTime.set(t, point);
    }
  }

  return { data: Array.from(byTime.values()).sort((a, b) => a.t - b.t), keys };
}

function timeTick(ms: unknown) {
  return new Date(Number(ms)).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatValue(v: number, unit?: string) {
  if (!Number.isFinite(v)) return "–";
  const digits = Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 1 ? 1 : 3;
  return `${v.toFixed(digits)}${unit ? ` ${unit}` : ""}`;
}

/** Step sized so a range always yields a readable number of points. */
function stepFor(minutes: number) {
  const targetPoints = 120;
  const seconds = Math.max(15, Math.round((minutes * 60) / targetPoints / 15) * 15);
  return `${seconds}s`;
}

function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: unknown;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-paper/95 px-3 py-2 shadow-lg backdrop-blur">
      <p className="mb-1.5 text-[11px] font-medium text-muted">{timeTick(label)}</p>
      <div className="flex flex-col gap-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="max-w-[220px] truncate text-muted">{entry.name}</span>
            <span className="ml-auto font-medium text-ink">
              {formatValue(Number(entry.value), unit)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartPanel({
  title,
  query,
  color,
  chartType,
  unit,
  onRemove,
}: {
  title: string;
  query: string;
  color: string;
  chartType: ChartType;
  unit?: string;
  onRemove?: () => void;
}) {
  const { minutes, nonce } = useTimeRange();
  const gradientId = useId().replace(/:/g, "");
  const [state, setState] = useState<{
    loading: boolean;
    error?: string;
    data: Point[];
    keys: string[];
  }>({ loading: true, data: [], keys: [] });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: undefined }));
    try {
      const res = await fetch(
        `/api/metrics?query=${encodeURIComponent(query)}&minutes=${minutes}&step=${stepFor(minutes)}`,
        { cache: "no-store" },
      );
      const json: PrometheusRangeResponse = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      const { data, keys } = toChartData(json);
      setState({ loading: false, data, keys });
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : "bilinmeyen hata",
        data: [],
        keys: [],
      });
    }
  }, [query, minutes]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load, nonce]);

  const colorFor = (i: number) => (i === 0 ? color : SERIES_PALETTE[i % SERIES_PALETTE.length]);
  const showLegend = state.keys.length > 1;

  const axes = (
    <>
      <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
      <XAxis
        dataKey="t"
        tickFormatter={timeTick}
        tick={{ fontSize: 11, fill: "var(--muted)" }}
        tickLine={false}
        axisLine={{ stroke: "var(--line)" }}
        minTickGap={40}
      />
      <YAxis
        tick={{ fontSize: 11, fill: "var(--muted)" }}
        tickLine={false}
        axisLine={false}
        width={44}
        tickFormatter={(v) => formatValue(Number(v))}
      />
      <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ stroke: "var(--line)" }} />
      {showLegend && (
        <Legend
          verticalAlign="bottom"
          height={28}
          iconType="circle"
          iconSize={7}
          wrapperStyle={{ fontSize: 11, color: "var(--muted)" }}
        />
      )}
    </>
  );

  return (
    <div className="group flex flex-col rounded-xl border border-line bg-paper p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-ink">{title}</h3>
          {unit && <p className="mt-0.5 text-[11px] text-muted">{unit}</p>}
        </div>
        {onRemove && (
          <button
            onClick={onRemove}
            className="rounded-md p-1.5 text-muted opacity-0 transition-opacity hover:bg-red-50 hover:text-red group-hover:opacity-100"
            title="Paneli kaldır"
            type="button"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div className="mt-3 h-56">
        {state.error ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center">
            <AlertCircle size={18} className="text-red" />
            <p className="max-w-xs text-xs text-red">{state.error}</p>
          </div>
        ) : state.data.length === 0 ? (
          <p className="flex h-full items-center justify-center text-xs text-muted">
            {state.loading ? "Yükleniyor…" : "Bu aralıkta veri yok"}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "bar" ? (
              <BarChart data={state.data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                {axes}
                {state.keys.map((key, i) => (
                  <Bar key={key} dataKey={key} fill={colorFor(i)} radius={[3, 3, 0, 0]} />
                ))}
              </BarChart>
            ) : chartType === "area" ? (
              <AreaChart data={state.data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  {state.keys.map((key, i) => (
                    <linearGradient key={key} id={`${gradientId}-${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={colorFor(i)} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={colorFor(i)} stopOpacity={0.02} />
                    </linearGradient>
                  ))}
                </defs>
                {axes}
                {state.keys.map((key, i) => (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={colorFor(i)}
                    strokeWidth={2}
                    fill={`url(#${gradientId}-${i})`}
                    dot={false}
                    activeDot={{ r: 3.5, strokeWidth: 0 }}
                  />
                ))}
              </AreaChart>
            ) : (
              <LineChart data={state.data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                {axes}
                {state.keys.map((key, i) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={colorFor(i)}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3.5, strokeWidth: 0 }}
                  />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
