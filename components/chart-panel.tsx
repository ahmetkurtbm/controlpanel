"use client";

import { useEffect, useState, useCallback } from "react";
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
  CartesianGrid,
} from "recharts";
import { RefreshCw, Trash2 } from "lucide-react";
import type { ChartType } from "@/lib/panel-presets";

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

function seriesLabel(metric: Record<string, string>) {
  const entries = Object.entries(metric).filter(([key]) => key !== "__name__");
  if (entries.length === 0) return "value";
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
  return new Date(Number(ms)).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

export function ChartPanel({
  title,
  query,
  color,
  chartType,
  minutes,
  onRemove,
}: {
  title: string;
  query: string;
  color: string;
  chartType: ChartType;
  minutes: number;
  onRemove?: () => void;
}) {
  const [state, setState] = useState<{ loading: boolean; error?: string; data: Point[]; keys: string[] }>({
    loading: true,
    data: [],
    keys: [],
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: undefined }));
    try {
      const res = await fetch(
        `/api/metrics?query=${encodeURIComponent(query)}&minutes=${minutes}`,
        { cache: "no-store" },
      );
      const json: PrometheusRangeResponse = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      const { data, keys } = toChartData(json);
      setState({ loading: false, data, keys });
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : "bilinmeyen hata", data: [], keys: [] });
    }
  }, [query, minutes]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const palette = [color, "#6c7873", "#2f6fb0", "#d28a24", "#6a4fb0"];

  return (
    <div className="rounded-xl border border-line bg-paper p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-ink">{title}</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={load}
            className="rounded-md p-1.5 text-muted hover:bg-canvas hover:text-ink"
            title="Yenile"
            type="button"
          >
            <RefreshCw size={14} />
          </button>
          {onRemove && (
            <button
              onClick={onRemove}
              className="rounded-md p-1.5 text-muted hover:bg-red-50 hover:text-red"
              title="Paneli kaldır"
              type="button"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 h-56">
        {state.error ? (
          <p className="flex h-full items-center justify-center text-center text-xs text-red">{state.error}</p>
        ) : state.data.length === 0 ? (
          <p className="flex h-full items-center justify-center text-xs text-muted">
            {state.loading ? "Yükleniyor…" : "Veri yok"}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "bar" ? (
              <BarChart data={state.data}>
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="t" tickFormatter={timeTick} tick={{ fontSize: 11, fill: "var(--muted)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} width={40} />
                <Tooltip labelFormatter={timeTick} />
                {state.keys.map((key, i) => (
                  <Bar key={key} dataKey={key} fill={palette[i % palette.length]} radius={[3, 3, 0, 0]} />
                ))}
              </BarChart>
            ) : chartType === "area" ? (
              <AreaChart data={state.data}>
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="t" tickFormatter={timeTick} tick={{ fontSize: 11, fill: "var(--muted)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} width={40} />
                <Tooltip labelFormatter={timeTick} />
                {state.keys.map((key, i) => (
                  <Area
                    key={key}
                    dataKey={key}
                    stroke={palette[i % palette.length]}
                    fill={palette[i % palette.length]}
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                ))}
              </AreaChart>
            ) : (
              <LineChart data={state.data}>
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="t" tickFormatter={timeTick} tick={{ fontSize: 11, fill: "var(--muted)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} width={40} />
                <Tooltip labelFormatter={timeTick} />
                {state.keys.map((key, i) => (
                  <Line
                    key={key}
                    dataKey={key}
                    stroke={palette[i % palette.length]}
                    strokeWidth={2}
                    dot={false}
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
