"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, ChevronRight, X } from "lucide-react";
import { Select } from "@/components/ui/select";
import { useTimeRange } from "@/components/time-range";

type TraceSummary = {
  traceID: string;
  rootServiceName?: string;
  rootTraceName?: string;
  startTimeUnixNano?: string;
  durationMs?: number;
};

type Span = {
  spanId: string;
  parentSpanId?: string;
  name: string;
  serviceName: string;
  kind?: string;
  startMs: number;
  durationMs: number;
  isError: boolean;
  attributes: Record<string, string>;
};

const MIN_DURATIONS = [
  { value: 0, label: "Tüm süreler" },
  { value: 100, label: "100 ms üstü" },
  { value: 500, label: "500 ms üstü" },
  { value: 1000, label: "1 sn üstü" },
  { value: 3000, label: "3 sn üstü" },
];

const STATUS_FILTERS = [
  { value: "all", label: "Tüm istekler" },
  { value: "errors", label: "Sadece hatalılar" },
];

function formatMs(ms?: number) {
  if (ms === undefined) return "–";
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} sn`;
  return `${Math.round(ms)} ms`;
}

function formatTime(nano?: string) {
  if (!nano) return "";
  return new Date(Number(nano) / 1e6).toLocaleTimeString("tr-TR");
}

export function TraceExplorer({ service }: { service: string }) {
  const { minutes, nonce } = useTimeRange();
  const [minDuration, setMinDuration] = useState(0);
  const [status, setStatus] = useState<string>("all");
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [openTrace, setOpenTrace] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const params = new URLSearchParams({
        service,
        minutes: String(minutes),
        minDurationMs: String(minDuration),
        errorsOnly: status === "errors" ? "1" : "0",
      });
      const res = await fetch(`/api/traces?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setTraces(json.traces ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "bilinmeyen hata");
      setTraces([]);
    } finally {
      setLoading(false);
    }
  }, [service, minutes, minDuration, status]);

  useEffect(() => {
    load();
  }, [load, nonce]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">İstekler (trace)</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={minDuration}
            onChange={setMinDuration}
            options={MIN_DURATIONS}
            className="w-40"
          />
          <Select value={status} onChange={setStatus} options={STATUS_FILTERS} className="w-44" />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-paper">
        {error ? (
          <div className="flex items-start gap-2.5 p-4">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-red" />
            <p className="text-sm text-red">{error}</p>
          </div>
        ) : loading ? (
          <p className="p-6 text-center text-sm text-muted">Yükleniyor…</p>
        ) : traces.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">
            Bu filtrelerle istek bulunamadı.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {traces.map((t) => (
              <li key={t.traceID}>
                <button
                  type="button"
                  onClick={() => setOpenTrace(t.traceID)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-canvas"
                >
                  <ChevronRight size={14} className="shrink-0 text-muted" />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">
                    {t.rootTraceName ?? "(isimsiz)"}
                  </span>
                  <span className="shrink-0 text-xs text-muted">{formatTime(t.startTimeUnixNano)}</span>
                  <span className="w-20 shrink-0 text-right text-sm font-medium text-ink">
                    {formatMs(t.durationMs)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {openTrace && <TraceDetail traceId={openTrace} onClose={() => setOpenTrace(null)} />}
    </section>
  );
}

function TraceDetail({ traceId, onClose }: { traceId: string; onClose: () => void }) {
  const [spans, setSpans] = useState<Span[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [selected, setSelected] = useState<Span | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/traces/${encodeURIComponent(traceId)}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        if (!cancelled) setSpans(json.spans ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "bilinmeyen hata");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [traceId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Depth comes from walking parentSpanId links, so nested calls indent the
  // way they do in a flame/waterfall view.
  const byId = new Map(spans.map((s) => [s.spanId, s]));
  function depthOf(span: Span, guard = 0): number {
    if (!span.parentSpanId || guard > 20) return 0;
    const parent = byId.get(span.parentSpanId);
    return parent ? depthOf(parent, guard + 1) + 1 : 0;
  }

  const traceStart = spans.length ? Math.min(...spans.map((s) => s.startMs)) : 0;
  const traceEnd = spans.length ? Math.max(...spans.map((s) => s.startMs + s.durationMs)) : 0;
  const total = Math.max(1, traceEnd - traceStart);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-paper shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-ink">İstek detayı</h3>
            <p className="truncate font-mono text-[11px] text-muted">{traceId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-canvas hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {error ? (
            <p className="text-sm text-red">{error}</p>
          ) : loading ? (
            <p className="text-sm text-muted">Yükleniyor…</p>
          ) : (
            <div className="flex flex-col gap-1">
              <div className="mb-2 flex items-center justify-between text-[11px] text-muted">
                <span>Toplam süre</span>
                <span className="font-medium text-ink">{formatMs(total)}</span>
              </div>

              {spans.map((span) => {
                const depth = depthOf(span);
                const left = ((span.startMs - traceStart) / total) * 100;
                const width = Math.max(0.5, (span.durationMs / total) * 100);

                return (
                  <button
                    key={span.spanId}
                    type="button"
                    onClick={() => setSelected(span)}
                    className="group flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-canvas"
                  >
                    <span
                      className="min-w-0 shrink-0 truncate text-xs text-ink"
                      style={{ paddingLeft: depth * 12, width: 260 }}
                      title={span.name}
                    >
                      {span.name}
                    </span>
                    <span className="relative h-4 flex-1 overflow-hidden rounded bg-canvas">
                      <span
                        className="absolute inset-y-0 rounded"
                        style={{
                          left: `${left}%`,
                          width: `${width}%`,
                          backgroundColor: span.isError ? "var(--red)" : "var(--green)",
                          opacity: 0.85,
                        }}
                      />
                    </span>
                    <span className="w-16 shrink-0 text-right text-xs text-muted">
                      {formatMs(span.durationMs)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {selected && (
            <div className="mt-5 rounded-xl border border-line bg-canvas p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-ink">{selected.name}</h4>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-xs text-muted hover:text-ink"
                >
                  kapat
                </button>
              </div>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
                <dt className="text-muted">Servis</dt>
                <dd className="text-ink">{selected.serviceName}</dd>
                <dt className="text-muted">Tür</dt>
                <dd className="text-ink">{selected.kind ?? "–"}</dd>
                <dt className="text-muted">Süre</dt>
                <dd className="text-ink">{formatMs(selected.durationMs)}</dd>
                {Object.entries(selected.attributes).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="truncate text-muted">{k}</dt>
                    <dd className="break-all text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
