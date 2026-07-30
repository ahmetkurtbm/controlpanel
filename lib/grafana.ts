import "server-only";

// Server-side only client for querying Grafana Cloud's hosted Prometheus
// (Mimir) and Loki, THROUGH the Grafana instance's own datasource-proxy API
// rather than hitting the raw prometheus-prod-xxx/logs-prod-xxx hostnames
// directly. Those raw endpoints require HTTP Basic Auth with a Cloud Access
// Policy token (username = numeric instance ID) — a different credential
// type than a Grafana Service Account token. Going through
// `${GRAFANA_URL}/api/datasources/proxy/uid/<uid>/...` lets us authenticate
// everywhere with a single Bearer token (the Service Account token), which
// is also what a Grafana Cloud "Viewer" service account is designed for.
//
// Required env vars (see .env.example):
//   GRAFANA_URL       e.g. https://<your-stack>.grafana.net (the Grafana
//                     instance itself — same URL you use to log into Grafana)
//   GRAFANA_PROM_UID  UID of the Prometheus datasource (Connections > Data
//                     sources > Prometheus > shown in the page URL)
//   GRAFANA_LOKI_UID  UID of the Loki datasource (same page, for Loki)
//   GRAFANA_API_TOKEN Service Account token, "Viewer" role is enough
//
// Nothing here is exposed to the browser — all calls happen in Server
// Components / Route Handlers.

export function isGrafanaConfigured() {
  return Boolean(
    process.env.GRAFANA_URL &&
      process.env.GRAFANA_PROM_UID &&
      process.env.GRAFANA_LOKI_UID &&
      process.env.GRAFANA_API_TOKEN,
  );
}

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.GRAFANA_API_TOKEN}`,
  };
}

function proxyUrl(datasourceUid: string, path: string) {
  return new URL(
    `/api/datasources/proxy/uid/${datasourceUid}${path}`,
    process.env.GRAFANA_URL,
  );
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
  const url = proxyUrl(process.env.GRAFANA_PROM_UID!, "/api/v1/query");
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
  const url = proxyUrl(process.env.GRAFANA_PROM_UID!, "/api/v1/query_range");
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
  const url = proxyUrl(process.env.GRAFANA_LOKI_UID!, "/loki/api/v1/query_range");
  url.searchParams.set("query", query);
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url, { headers: authHeaders(), cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Loki query failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}
