import "server-only";

// Server-side only client for querying Grafana Cloud's hosted Prometheus
// (Mimir) and Loki via their HTTP APIs, authenticated with a Grafana Cloud
// Service Account token (read-only "Viewer" role is enough).
//
// Required env vars (see .env.example):
//   GRAFANA_PROM_URL    e.g. https://<stack>.grafana.net/api/prom  (or the
//                       Prometheus datasource's own query URL)
//   GRAFANA_LOKI_URL    e.g. https://logs-prod-xxx.grafana.net
//   GRAFANA_API_TOKEN   Service Account token (Viewer role)
//
// Nothing here is exposed to the browser — all calls happen in Server
// Components / Route Handlers.

export function isGrafanaConfigured() {
  return Boolean(
    process.env.GRAFANA_PROM_URL &&
      process.env.GRAFANA_LOKI_URL &&
      process.env.GRAFANA_API_TOKEN,
  );
}

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.GRAFANA_API_TOKEN}`,
  };
}

export type PrometheusVector = {
  status: string;
  data: {
    resultType: "vector" | "matrix";
    result: Array<{
      metric: Record<string, string>;
      value?: [number, string];
      values?: Array<[number, string]>;
    }>;
  };
};

/** Instant query, e.g. `sum(rate(traces_spanmetrics_calls_total{service_name="gatehub"}[5m]))` */
export async function promQuery(query: string): Promise<PrometheusVector> {
  const url = new URL("/api/v1/query", process.env.GRAFANA_PROM_URL);
  url.searchParams.set("query", query);

  const res = await fetch(url, {
    headers: authHeaders(),
    // Metrics move fast; never serve a cached response.
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Prometheus query failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/** Range query for timeseries panels. */
export async function promQueryRange(
  query: string,
  { start, end, step }: { start: number; end: number; step: string },
): Promise<PrometheusVector> {
  const url = new URL("/api/v1/query_range", process.env.GRAFANA_PROM_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("start", String(start));
  url.searchParams.set("end", String(end));
  url.searchParams.set("step", step);

  const res = await fetch(url, { headers: authHeaders(), cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Prometheus range query failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/** Recent log lines for a LogQL query, e.g. `{service_name="gatehub"} |= "error"` */
export async function lokiQuery(query: string, limit = 100) {
  const url = new URL("/loki/api/v1/query_range", process.env.GRAFANA_LOKI_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url, { headers: authHeaders(), cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Loki query failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}
