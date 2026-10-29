import "server-only";
import type { LokiStream, PrometheusVector } from "@/lib/grafana";
import type { Span, TraceSummary } from "@/lib/tempo";

// Demo mode: without Grafana Cloud credentials (the public Vercel deployment)
// every query is answered from here instead of the network. The numbers are
// generated, but shaped like the real Prometheus/Loki/Tempo responses, so the
// whole UI — charts, alerts, log viewer, trace waterfall — runs unchanged.
//
// Values are a smooth function of time plus a per-service seed: reloading
// shows a plausible, slowly moving picture instead of random noise.

export const DEMO_SERVICES = ["gastroflow", "kidsacademy", "receiptflow", "testmetrix"];

type Profile = { rps: number; errorRatio: number; p50: number; routes: string[]; outbound: string[] };

const PROFILES: Record<string, Profile> = {
  gastroflow: { rps: 2.4, errorRatio: 0.012, p50: 85, routes: ["GET /pos", "POST /api/orders", "GET /kitchen", "GET /m"], outbound: ["postgres", "GET qr-menu"] },
  kidsacademy: { rps: 0.6, errorRatio: 0.004, p50: 120, routes: ["GET /", "GET /veli/[slug]", "POST /api/veli/login", "GET /admin"], outbound: ["supabase rest", "supabase storage"] },
  // Deliberately unhealthy so the alerts page has something to show.
  receiptflow: { rps: 0.3, errorRatio: 0.09, p50: 950, routes: ["POST /api/receipts", "GET /receipts", "GET /"], outbound: ["POST ai/vision", "postgres"] },
  testmetrix: { rps: 1.1, errorRatio: 0.006, p50: 140, routes: ["GET /", "POST /api/exams", "GET /exams/[id]/report", "GET /folders"], outbound: ["postgres", "POST resend"] },
};

function seedOf(text: string) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  // Final avalanche (murmur3 fmix32) so neighbouring inputs like "x-1"/"x-2"
  // don't produce neighbouring outputs.
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

/** Smooth daily curve with a little per-series wobble, always > 0. */
function wave(seed: number, t: number) {
  const day = Math.sin((t / 86400) * 2 * Math.PI - 1.2) * 0.35;
  const wobble = Math.sin(t / 700 + seed * 40) * 0.12 + Math.sin(t / 173 + seed * 9) * 0.06;
  return Math.max(0.05, 1 + day + wobble);
}

function serviceOf(query: string) {
  return /service(?:_name)?="([^"]+)"/.exec(query)?.[1];
}

/** Turns a PromQL expression from metrics-schema.ts into a number at time t. */
function valueFor(query: string, service: string, label: string, t: number) {
  const profile = PROFILES[service] ?? PROFILES.testmetrix;
  const seed = seedOf(service + label);

  if (query.startsWith("time() -")) return 20 + seed * 90; // freshness, seconds

  const quantile = /histogram_quantile\(([\d.]+)/.exec(query)?.[1];
  if (quantile) {
    const q = Number(quantile);
    const tail = q >= 0.99 ? 4.2 : q >= 0.95 ? 2.6 : 1;
    return profile.p50 * tail * wave(seed, t) * (label ? 0.6 + seed : 1);
  }

  const client = query.includes("SPAN_KIND_CLIENT");
  let rps = profile.rps * (client ? 0.7 : 1) * wave(seed, t);
  if (label) rps *= 0.15 + seed * 0.5;
  if (query.includes("STATUS_CODE_ERROR")) rps *= profile.errorRatio * (1 + Math.sin(t / 900 + seed * 7));
  return rps;
}

function seriesFor(query: string) {
  const service = serviceOf(query);
  const services = service ? [service] : DEMO_SERVICES;
  const grouped = /by \((?:le, )?span_name\)/.test(query);
  return services.flatMap((s) => {
    const profile = PROFILES[s] ?? PROFILES.testmetrix;
    const labels = grouped ? (query.includes("SPAN_KIND_CLIENT") ? profile.outbound : profile.routes) : [""];
    return labels.map((label) => ({ service: s, label }));
  });
}

function metricLabels(service: string, label: string): Record<string, string> {
  return label ? { service, span_name: label } : { service };
}

export function demoQuery(query: string): PrometheusVector {
  const t = Date.now() / 1000;
  return {
    status: "success",
    data: {
      resultType: "vector",
      result: seriesFor(query).map(({ service, label }) => ({
        metric: metricLabels(service, label),
        value: [t, String(valueFor(query, service, label, t))],
      })),
    },
  };
}

export function demoQueryRange(query: string, { start, end, step }: { start: number; end: number; step: string }): PrometheusVector {
  const stepSeconds = Math.max(15, parseInt(step, 10) * (step.endsWith("m") ? 60 : 1) || 30);
  return {
    status: "success",
    data: {
      resultType: "matrix",
      result: seriesFor(query).map(({ service, label }) => {
        const values: Array<[number, string]> = [];
        for (let t = start; t <= end; t += stepSeconds) values.push([t, String(valueFor(query, service, label, t))]);
        return { metric: metricLabels(service, label), values };
      }),
    },
  };
}

export function demoMetricNames() {
  return [
    "traces_spanmetrics_calls_total",
    "traces_spanmetrics_latency_bucket",
    "traces_spanmetrics_latency_count",
    "traces_spanmetrics_latency_sum",
    "traces_spanmetrics_size_total",
  ];
}

const LOG_TEMPLATES: Array<[string, string]> = [
  ["INFO", "request completed method=GET status=200"],
  ["INFO", "session refreshed"],
  ["INFO", "cache miss, loaded from database"],
  ["WARN", "slow query took 840ms"],
  ["WARN", "retrying upstream request (attempt 2)"],
  ["ERROR", "upstream timeout after 10000ms"],
  ["DEBUG", "rendered page in 42ms"],
];

export function demoLogs(query: string, { minutes = 60, limit = 100 }: { minutes?: number; limit?: number }): LokiStream[] {
  const service = serviceOf(query) ?? DEMO_SERVICES[0];
  const level = /severity_text = `(\w+)`/.exec(query)?.[1];
  const search = /\|= `([^`]*)`/.exec(query)?.[1]?.toLowerCase();
  const profile = PROFILES[service] ?? PROFILES.testmetrix;
  const now = Date.now();
  const byLevel = new Map<string, Array<[string, string]>>();

  for (let i = 0; i < 400 && [...byLevel.values()].flat().length < limit; i++) {
    const at = now - i * ((minutes * 60_000) / 400);
    const r = seedOf(`${service}${Math.floor(at / 60_000)}${i}`);
    const [severity, text] = LOG_TEMPLATES[Math.floor(r * LOG_TEMPLATES.length)];
    if (severity === "ERROR" && r > profile.errorRatio * 40) continue;
    if (level && severity !== level) continue;
    const route = profile.routes[i % profile.routes.length];
    const line = `${text} route="${route}" trace_id=${Math.floor(r * 1e16).toString(16).padStart(16, "0")}`;
    if (search && !line.toLowerCase().includes(search)) continue;
    const list = byLevel.get(severity) ?? [];
    list.push([String(Math.round(at * 1e6)), line]);
    byLevel.set(severity, list);
  }

  return [...byLevel].map(([severity, values]) => ({ stream: { service_name: service, severity_text: severity }, values }));
}

function traceId(service: string, i: number) {
  return Array.from({ length: 4 }, (_, k) => Math.floor(seedOf(`${service}-${i}-${k}`) * 0xffffffff).toString(16).padStart(8, "0")).join("");
}

/** The i-th demo trace of a service; list and detail views both read from here. */
function traceAt(service: string, i: number) {
  const profile = PROFILES[service] ?? PROFILES.testmetrix;
  const r = seedOf(`${service}-${i}`);
  return {
    id: traceId(service, i),
    route: profile.routes[i % profile.routes.length],
    failed: r < profile.errorRatio * 4,
    durationMs: Math.round(profile.p50 * (0.4 + r * r * 5)),
  };
}

const TRACES_PER_SERVICE = 200;

export function demoTraces({ service, minutes, minDurationMs, errorsOnly, limit = 20 }: {
  service: string; minutes: number; minDurationMs?: number; errorsOnly?: boolean; limit?: number;
}): TraceSummary[] {
  const now = Date.now();
  const traces: TraceSummary[] = [];
  for (let i = 0; i < TRACES_PER_SERVICE && traces.length < limit; i++) {
    const trace = traceAt(service, i);
    if (errorsOnly && !trace.failed) continue;
    if (minDurationMs && trace.durationMs < minDurationMs) continue;
    traces.push({
      traceID: trace.id,
      rootServiceName: service,
      rootTraceName: trace.route,
      startTimeUnixNano: String((now - i * ((minutes * 60_000) / TRACES_PER_SERVICE)) * 1e6),
      durationMs: trace.durationMs,
    });
  }
  return traces;
}

export function demoTrace(id: string): Span[] {
  let service = DEMO_SERVICES[0];
  let trace = traceAt(service, 0);
  for (const s of DEMO_SERVICES) {
    for (let i = 0; i < TRACES_PER_SERVICE; i++) {
      if (traceId(s, i) === id) { service = s; trace = traceAt(s, i); }
    }
  }
  const profile = PROFILES[service] ?? PROFILES.testmetrix;
  const total = trace.durationMs;
  const start = Date.now() - 60_000;
  const span = (spanId: string, name: string, offset: number, duration: number, extra: Partial<Span> = {}): Span => ({
    spanId, name, serviceName: service, kind: "INTERNAL", startMs: start + offset, durationMs: duration, isError: false, attributes: {}, ...extra,
  });
  return [
    span("a1", trace.route, 0, total, { kind: "SERVER", isError: trace.failed, attributes: { "http.route": trace.route, "http.status_code": trace.failed ? "500" : "200" } }),
    span("b2", "auth.session", 2, total * 0.08, { parentSpanId: "a1" }),
    span("c3", profile.outbound[0], total * 0.12, total * 0.45, { parentSpanId: "a1", kind: "CLIENT", isError: trace.failed, attributes: { "db.system": "postgresql" } }),
    span("d4", "render", total * 0.6, total * 0.35, { parentSpanId: "a1" }),
  ];
}
