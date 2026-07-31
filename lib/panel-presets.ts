// Client-safe preset descriptors. The actual PromQL is resolved on the
// server (see lib/metrics-schema.ts) because the right latency expression
// depends on which histogram shape Tempo published for that service.

export type PresetId =
  | "rate"
  | "errors"
  | "duration_p95"
  | "duration_p50"
  | "duration_p99"
  | "rate_by_route"
  | "errors_by_route"
  | "duration_by_route"
  | "outbound_rate"
  | "outbound_by_target";

export type PresetMeta = { label: string; unit: string };

export const PRESET_META: Record<PresetId, PresetMeta> = {
  rate: { label: "İstek oranı", unit: "req/s" },
  errors: { label: "Hata oranı", unit: "req/s" },
  duration_p50: { label: "Gecikme p50 (medyan)", unit: "ms" },
  duration_p95: { label: "Gecikme p95", unit: "ms" },
  duration_p99: { label: "Gecikme p99", unit: "ms" },
  rate_by_route: { label: "Rota bazında istek oranı", unit: "req/s" },
  errors_by_route: { label: "Rota bazında hata oranı", unit: "req/s" },
  duration_by_route: { label: "Rota bazında gecikme p95", unit: "ms" },
  outbound_rate: { label: "Giden çağrı oranı", unit: "req/s" },
  outbound_by_target: { label: "Hedef bazında giden çağrılar", unit: "req/s" },
};

/** Server-resolved PromQL for one service; null when unsupported by its data. */
export type ServiceQueries = {
  service: string;
  queries: Partial<Record<PresetId, string>>;
  /** Every metric name this service publishes. */
  available: string[];
  /** Seconds since the service last reported; drives the freshness badge. */
  freshnessQuery: string;
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
  unit?: string;
};
