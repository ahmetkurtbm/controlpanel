import "server-only";

// Server-side only client for querying Grafana Cloud's hosted Prometheus
// (Mimir) and Loki DIRECTLY (not through Grafana's own datasource-proxy API,
// which returns 404 for Grafana Cloud's managed datasources). These hosted
// endpoints use HTTP Basic Auth, where the username is the numeric
// "User"/Instance ID shown on each datasource's settings page (Connections >
// Data sources > Prometheus/Loki > Authentication > "User" field) and the
// password is a Grafana Cloud Service Account token ("Viewer" role is
// enough).
//
// Required env vars (see .env.example):
//   GRAFANA_PROM_URL   e.g. https://prometheus-prod-65-prod-eu-west-2.grafana.net/api/prom
//   GRAFANA_PROM_USER  numeric "User" shown on the Prometheus datasource page
//   GRAFANA_LOKI_URL   e.g. https://logs-prod-012.grafana.net
//   GRAFANA_LOKI_USER  numeric "User" shown on the Loki datasource page
//   GRAFANA_API_TOKEN  Service Account token, used as the Basic Auth password
//                      for both Prometheus and Loki
//
// Nothing here is exposed to the browser — all calls happen in Server
// Components / Route Handlers.

export function isGrafanaConfigured() {
  return Boolean(
    process.env.GRAFANA_PROM_URL &&
      process.env.GRAFANA_PROM_USER &&
      process.env.GRAFANA_LOKI_URL &&
      process.env.GRAFANA_LOKI_USER &&
      process.env.GRAFANA_API_TOKEN,
  );
}

function basicAuthHeader(user: string) {
  const token = Buffer.from(`${user}:${process.env.GRAFANA_API_TOKEN}`).toString("base64");
  return { Authorization: `Basic ${token}` };
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
    headers: basicAuthHeader(process.env.GRAFANA_PROM_USER!),
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

  const res = await fetch(url, {
    headers: basicAuthHeader(process.env.GRAFANA_PROM_USER!),
    cache: "no-store",
  });
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

  const res = await fetch(url, {
    headers: basicAuthHeader(process.env.GRAFANA_LOKI_USER!),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Loki query failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}
