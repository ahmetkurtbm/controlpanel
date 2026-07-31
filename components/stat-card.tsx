"use client";

import { useEffect, useState, useCallback, useId } from "react";
import { ResponsiveContainer, AreaChart, Area } from "recharts";
import { useTimeRange } from "@/components/time-range";

type Props = {
  label: string;
  query: string | null;
  unit: string;
  color: string;
  /** Shown instead of a value when the metric isn't published at all. */
  unavailableNote?: string;
};

export function StatCard({ label, query, unit, color, unavailableNote }: Props) {
  const { minutes, nonce } = useTimeRange();
  const gradientId = useId().replace(/:/g, "");
  const [value, setValue] = useState<number | null>(null);
  const [spark, setSpark] = useState<Array<{ v: number }>>([]);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!query) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const res = await fetch(
        `/api/metrics?query=${encodeURIComponent(query)}&minutes=${minutes}`,
        { cache: "no-store" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);

      const values: Array<[number, string]> = json.data?.result?.[0]?.values ?? [];
      setSpark(values.map(([, v]) => ({ v: Number(v) })));
      setValue(values.length ? Number(values[values.length - 1][1]) : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "hata");
    } finally {
      setLoading(false);
    }
  }, [query, minutes]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load, nonce]);

  const display = () => {
    if (!query) return "–";
    if (error) return "–";
    if (loading && value === null) return "…";
    if (value === null || !Number.isFinite(value)) return "0";
    const digits = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 1 ? 1 : 3;
    return value.toFixed(digits);
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-paper p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1.5 text-3xl font-semibold tracking-tight text-ink">
        {display()}
        <span className="ml-1 text-xs font-normal text-muted">{unit}</span>
      </p>

      {!query && unavailableNote && (
        <p className="mt-1 text-[11px] leading-snug text-amber">{unavailableNote}</p>
      )}
      {error && <p className="mt-1 truncate text-[11px] text-red">{error}</p>}

      {spark.length > 1 && (
        <div className="mt-3 h-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={color}
                strokeWidth={1.75}
                fill={`url(#${gradientId})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
