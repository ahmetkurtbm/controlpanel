import "server-only";
import { promMetricNames } from "@/lib/grafana";
import type { PresetId, ServiceQueries } from "@/lib/panel-presets";

// Tempo's metrics-generator emits its latency histogram under different
// names depending on version and histogram mode, which is why a hardcoded
// `traces_spanmetrics_latency_bucket` query silently returned nothing:
//
//   classic (older):  traces_spanmetrics_latency_bucket
//   classic (newer):  traces_spanmetrics_duration_seconds_bucket
//   native histogram: traces_spanmetrics_latency   (no _bucket, no `le`)
//
// Rather than guess, we ask Prometheus which names exist for this service
// and build the matching histogram_quantile expression.

export type ServiceSchema = {
  service: string;
  /** Metric backing request counts. */
  callsMetric: string;
  /** Base name of the latency histogram, or null when none is published. */
  latencyMetric: string | null;
  /** Native histograms are queried without `_bucket`/`by (le)`. */
  latencyIsNative: boolean;
  /** Every metric name this service publishes — surfaced in the UI. */
  available: string[];
};

const CALLS_CANDIDATES = ["traces_spanmetrics_calls_total", "traces_span_metrics_calls_total"];

const LATENCY_CANDIDATES = [
  "traces_spanmetrics_latency",
  "traces_spanmetrics_duration_seconds",
  "traces_span_metrics_duration_seconds",
  "traces_spanmetrics_duration_milliseconds",
];

export async function getServiceSchema(service: string): Promise<ServiceSchema> {
  const available = await promMetricNames(`{service="${service}"}`);
  const set = new Set(available);

  const callsMetric = CALLS_CANDIDATES.find((n) => set.has(n)) ?? CALLS_CANDIDATES[0];

  let latencyMetric: string | null = null;
  let latencyIsNative = false;

  for (const base of LATENCY_CANDIDATES) {
    if (set.has(`${base}_bucket`)) {
      latencyMetric = base;
      latencyIsNative = false;
      break;
    }
    // A native histogram exposes the base name directly, with no _bucket
    // sibling — check that the sum/count classic siblings are absent too so
    // we don't misread a partially-scraped classic histogram.
    if (set.has(base) && !set.has(`${base}_bucket`)) {
      latencyMetric = base;
      latencyIsNative = true;
      break;
    }
  }

  return { service, callsMetric, latencyMetric, latencyIsNative, available };
}

/** Builds a quantile expression appropriate to the discovered histogram shape. */
export function latencyQuery(
  schema: ServiceSchema,
  quantile: number,
  { spanKind = "SPAN_KIND_SERVER", by }: { spanKind?: string; by?: string } = {},
): string | null {
  if (!schema.latencyMetric) return null;

  const selector = `{service="${schema.service}",span_kind="${spanKind}"}`;
  const grouping = by ? `by (le, ${by})` : "by (le)";

  // Milliseconds-named histograms are already in ms; everything else is
  // seconds and needs scaling for display.
  const scale = schema.latencyMetric.includes("milliseconds") ? "" : " * 1000";

  if (schema.latencyIsNative) {
    const nativeGrouping = by ? `by (${by})` : "";
    return `histogram_quantile(${quantile}, sum(rate(${schema.latencyMetric}${selector}[5m])) ${nativeGrouping})${scale}`;
  }

  return `histogram_quantile(${quantile}, sum(rate(${schema.latencyMetric}_bucket${selector}[5m])) ${grouping})${scale}`;
}

export function callsQuery(
  schema: ServiceSchema,
  { spanKind = "SPAN_KIND_SERVER", errorsOnly = false, by }: { spanKind?: string; errorsOnly?: boolean; by?: string } = {},
): string {
  const labels = [`service="${schema.service}"`, `span_kind="${spanKind}"`];
  if (errorsOnly) labels.push(`status_code="STATUS_CODE_ERROR"`);
  const selector = `{${labels.join(",")}}`;
  const grouping = by ? ` by (${by})` : "";
  return `sum(rate(${schema.callsMetric}${selector}[5m]))${grouping}`;
}

/** Resolves every preset into concrete PromQL for one service. */
export async function getServiceQueries(service: string): Promise<ServiceQueries> {
  const schema = await getServiceSchema(service);
  const queries: Partial<Record<PresetId, string>> = {
    rate: callsQuery(schema),
    errors: callsQuery(schema, { errorsOnly: true }),
    rate_by_route: callsQuery(schema, { by: "span_name" }),
    errors_by_route: callsQuery(schema, { errorsOnly: true, by: "span_name" }),
    outbound_rate: callsQuery(schema, { spanKind: "SPAN_KIND_CLIENT" }),
    outbound_by_target: callsQuery(schema, { spanKind: "SPAN_KIND_CLIENT", by: "span_name" }),
  };

  const p50 = latencyQuery(schema, 0.5);
  const p95 = latencyQuery(schema, 0.95);
  const p99 = latencyQuery(schema, 0.99);
  const byRoute = latencyQuery(schema, 0.95, { by: "span_name" });
  if (p50) queries.duration_p50 = p50;
  if (p95) queries.duration_p95 = p95;
  if (p99) queries.duration_p99 = p99;
  if (byRoute) queries.duration_by_route = byRoute;

  return { service, queries, available: schema.available };
}
