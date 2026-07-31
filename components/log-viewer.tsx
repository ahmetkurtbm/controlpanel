"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Search } from "lucide-react";
import { Select } from "@/components/ui/select";
import { useTimeRange } from "@/components/time-range";

type LogLine = {
  timestamp: number;
  line: string;
  labels: Record<string, string>;
};

const LEVELS = [
  { value: "all", label: "Tüm seviyeler" },
  { value: "error", label: "Hata" },
  { value: "warn", label: "Uyarı" },
  { value: "info", label: "Bilgi" },
  { value: "debug", label: "Hata ayıklama" },
];

const LEVEL_STYLES: Record<string, string> = {
  ERROR: "text-red",
  WARN: "text-amber",
  INFO: "text-blue",
  DEBUG: "text-muted",
};

function severityOf(labels: Record<string, string>) {
  return (labels.severity_text ?? labels.detected_level ?? "").toUpperCase();
}

export function LogViewer({ service }: { service: string }) {
  const { minutes, nonce } = useTimeRange();
  const [level, setLevel] = useState("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [lines, setLines] = useState<LogLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search), 400);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const params = new URLSearchParams({ service, minutes: String(minutes), level });
      if (debounced) params.set("search", debounced);

      const res = await fetch(`/api/logs?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setLines(json.lines ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "bilinmeyen hata");
      setLines([]);
    } finally {
      setLoading(false);
    }
  }, [service, minutes, level, debounced]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load, nonce]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">Loglar</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-line bg-paper px-3 py-2">
            <Search size={14} className="text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Metin ara…"
              className="w-40 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
            />
          </div>
          <Select value={level} onChange={setLevel} options={LEVELS} className="w-44" />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-paper">
        {error ? (
          <div className="flex items-start gap-2.5 p-4">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-red" />
            <p className="text-sm text-red">{error}</p>
          </div>
        ) : loading && lines.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">Yükleniyor…</p>
        ) : lines.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-muted">Bu aralıkta log yok.</p>
            <p className="mt-1 text-xs text-muted">
              Uygulamanın OpenTelemetry log gönderecek şekilde yapılandırılmış olması gerekir.
            </p>
          </div>
        ) : (
          <ul className="max-h-[420px] divide-y divide-line overflow-auto">
            {lines.map((l, i) => {
              const sev = severityOf(l.labels);
              return (
                <li key={`${l.timestamp}-${i}`} className="flex gap-3 px-4 py-2 font-mono text-xs">
                  <span className="shrink-0 text-muted">
                    {new Date(l.timestamp).toLocaleTimeString("tr-TR")}
                  </span>
                  {sev && (
                    <span className={`w-12 shrink-0 font-medium ${LEVEL_STYLES[sev] ?? "text-muted"}`}>
                      {sev}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 break-all text-ink">{l.line}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
