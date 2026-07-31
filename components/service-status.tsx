"use client";

import { useEffect, useState, useCallback } from "react";
import { useTimeRange } from "@/components/time-range";

type Status = "active" | "quiet" | "stale" | "silent" | "unknown";

const STYLES: Record<Status, { dot: string; text: string; label: (s: number) => string }> = {
  active: {
    dot: "bg-brand",
    text: "text-brand",
    label: () => "aktif",
  },
  quiet: {
    dot: "bg-brand/50",
    text: "text-muted",
    label: (s) => `son veri ${Math.round(s / 60)} dk önce`,
  },
  stale: {
    dot: "bg-amber",
    text: "text-amber",
    label: (s) => `son veri ${Math.round(s / 3600)} sa önce`,
  },
  silent: {
    dot: "bg-red",
    text: "text-red",
    label: () => "24 saattir veri yok",
  },
  unknown: {
    dot: "bg-muted",
    text: "text-muted",
    label: () => "durum bilinmiyor",
  },
};

function classify(seconds: number | null): Status {
  if (seconds === null) return "silent";
  if (seconds < 300) return "active";
  if (seconds < 3600) return "quiet";
  return "stale";
}

export function ServiceStatus({ query }: { query: string }) {
  const { nonce } = useTimeRange();
  const [status, setStatus] = useState<Status>("unknown");
  const [seconds, setSeconds] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/metrics/instant?query=${encodeURIComponent(query)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      const raw = json.data?.result?.[0]?.value?.[1];
      const value = raw === undefined ? null : Number(raw);
      setSeconds(value);
      setStatus(classify(value));
    } catch {
      setStatus("unknown");
    }
  }, [query]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load, nonce]);

  const style = STYLES[status];

  return (
    <span className={`flex items-center gap-1.5 text-xs ${style.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {style.label(seconds ?? 0)}
    </span>
  );
}
