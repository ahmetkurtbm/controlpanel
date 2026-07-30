// Built-in metric presets, built from the labels Tempo's metrics-generator
// actually produces (confirmed via Grafana Explore): traces_spanmetrics_*
// with a `service` label (not `service_name`) and `span_kind`.
export type PresetId =
  | "rate"
  | "errors"
  | "duration_p95"
  | "duration_p50"
  | "rate_by_route"
  | "errors_by_route"
  | "calls_by_client"
  | "outbound_rate";

export const PRESETS: Record<PresetId, { label: string; unit: string; query: (service: string) => string }> = {
  rate: {
    label: "İstek oranı (Rate)",
    unit: "req/s",
    query: (service) =>
      `sum(rate(traces_spanmetrics_calls_total{service="${service}",span_kind="SPAN_KIND_SERVER"}[5m]))`,
  },
  errors: {
    label: "Hata oranı (Errors)",
    unit: "req/s",
    query: (service) =>
      `sum(rate(traces_spanmetrics_calls_total{service="${service}",span_kind="SPAN_KIND_SERVER",status_code="STATUS_CODE_ERROR"}[5m]))`,
  },
  duration_p95: {
    label: "Gecikme p95",
    unit: "ms",
    query: (service) =>
      `histogram_quantile(0.95, sum(rate(traces_spanmetrics_latency_bucket{service="${service}",span_kind="SPAN_KIND_SERVER"}[5m])) by (le)) * 1000`,
  },
  duration_p50: {
    label: "Gecikme p50 (medyan)",
    unit: "ms",
    query: (service) =>
      `histogram_quantile(0.50, sum(rate(traces_spanmetrics_latency_bucket{service="${service}",span_kind="SPAN_KIND_SERVER"}[5m])) by (le)) * 1000`,
  },
  rate_by_route: {
    label: "Rota bazında istek oranı",
    unit: "req/s",
    query: (service) =>
      `sum(rate(traces_spanmetrics_calls_total{service="${service}",span_kind="SPAN_KIND_SERVER"}[5m])) by (span_name)`,
  },
  errors_by_route: {
    label: "Rota bazında hata oranı",
    unit: "req/s",
    query: (service) =>
      `sum(rate(traces_spanmetrics_calls_total{service="${service}",span_kind="SPAN_KIND_SERVER",status_code="STATUS_CODE_ERROR"}[5m])) by (span_name)`,
  },
  calls_by_client: {
    label: "Giden çağrılar (outbound)",
    unit: "req/s",
    query: (service) =>
      `sum(rate(traces_spanmetrics_calls_total{service="${service}",span_kind="SPAN_KIND_CLIENT"}[5m])) by (span_name)`,
  },
  outbound_rate: {
    label: "Toplam giden istek oranı",
    unit: "req/s",
    query: (service) =>
      `sum(rate(traces_spanmetrics_calls_total{service="${service}",span_kind="SPAN_KIND_CLIENT"}[5m]))`,
  },
};

export const CHART_COLORS = [
  { name: "Yeşil", value: "#176b4d" },
  { name: "Mavi", value: "#2f6fb0" },
  { name: "Mor", value: "#6a4fb0" },
  { name: "Turuncu", value: "#d28a24" },
  { name: "Kırmızı", value: "#b9473e" },
  { name: "Pembe", value: "#c04d8a" },
] as const;

export type ChartType = "line" | "bar" | "area";

export type PanelConfig = {
  id: string;
  title: string;
  query: string;
  color: string;
  chartType: ChartType;
  minutes: number;
};
