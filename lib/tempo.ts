import "server-only";
import { basicAuthHeader, joinUrl } from "@/lib/grafana";

// Tempo holds the individual request traces the metrics are derived from.
// Same Basic Auth scheme as Prometheus/Loki: username is the numeric "User"
// on the Tempo datasource page, password is the shared access-policy token.
//
//   GRAFANA_TEMPO_URL   e.g. https://tempo-prod-10-prod-eu-west-2.grafana.net/tempo
//   GRAFANA_TEMPO_USER  numeric "User" from that datasource page

export function isTempoConfigured() {
  return Boolean(
    process.env.GRAFANA_TEMPO_URL &&
      process.env.GRAFANA_TEMPO_USER &&
      process.env.GRAFANA_API_TOKEN,
  );
}

export type TraceSummary = {
  traceID: string;
  rootServiceName?: string;
  rootTraceName?: string;
  startTimeUnixNano?: string;
  durationMs?: number;
};

export type SearchFilters = {
  service: string;
  minutes: number;
  /** Only traces slower than this, in milliseconds. */
  minDurationMs?: number;
  /** Only traces containing an errored span. */
  errorsOnly?: boolean;
  limit?: number;
};

function buildTraceQL({ service, minDurationMs, errorsOnly }: SearchFilters) {
  const conditions = [`resource.service.name = "${service}"`];
  if (errorsOnly) conditions.push(`status = error`);
  if (minDurationMs && minDurationMs > 0) conditions.push(`duration > ${minDurationMs}ms`);
  return `{ ${conditions.join(" && ")} }`;
}

export async function tempoSearch(filters: SearchFilters): Promise<TraceSummary[]> {
  const end = Math.floor(Date.now() / 1000);
  const start = end - Math.max(1, filters.minutes) * 60;

  const url = joinUrl(process.env.GRAFANA_TEMPO_URL!, "/api/search");
  url.searchParams.set("q", buildTraceQL(filters));
  url.searchParams.set("start", String(start));
  url.searchParams.set("end", String(end));
  url.searchParams.set("limit", String(filters.limit ?? 20));

  const res = await fetch(url, {
    headers: { ...basicAuthHeader(process.env.GRAFANA_TEMPO_USER!), Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Tempo search failed: ${res.status} ${await res.text()}`);
  }
  const json: { traces?: TraceSummary[] } = await res.json();
  return json.traces ?? [];
}

/** One span, flattened out of Tempo's nested OTLP batch structure. */
export type Span = {
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

type OtlpValue = {
  stringValue?: string;
  intValue?: string | number;
  doubleValue?: number;
  boolValue?: boolean;
};
type OtlpAttr = { key: string; value?: OtlpValue };

function attrsToRecord(attributes: OtlpAttr[] = []): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { key, value } of attributes) {
    if (!value) continue;
    const v =
      value.stringValue ??
      value.intValue ??
      value.doubleValue ??
      (value.boolValue !== undefined ? String(value.boolValue) : undefined);
    if (v !== undefined) out[key] = String(v);
  }
  return out;
}

const SPAN_KINDS = [
  "UNSPECIFIED",
  "INTERNAL",
  "SERVER",
  "CLIENT",
  "PRODUCER",
  "CONSUMER",
] as const;

export async function tempoTrace(traceId: string): Promise<Span[]> {
  const url = joinUrl(process.env.GRAFANA_TEMPO_URL!, `/api/traces/${encodeURIComponent(traceId)}`);

  const res = await fetch(url, {
    headers: { ...basicAuthHeader(process.env.GRAFANA_TEMPO_USER!), Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Tempo trace fetch failed: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  const spans: Span[] = [];

  for (const batch of json.batches ?? []) {
    const resourceAttrs = attrsToRecord(batch.resource?.attributes);
    const serviceName = resourceAttrs["service.name"] ?? "bilinmiyor";

    for (const scope of batch.scopeSpans ?? batch.instrumentationLibrarySpans ?? []) {
      for (const s of scope.spans ?? []) {
        const startNs = Number(s.startTimeUnixNano ?? 0);
        const endNs = Number(s.endTimeUnixNano ?? 0);
        spans.push({
          spanId: s.spanId,
          parentSpanId: s.parentSpanId || undefined,
          name: s.name ?? "(isimsiz)",
          serviceName,
          kind: typeof s.kind === "number" ? SPAN_KINDS[s.kind] : s.kind,
          startMs: startNs / 1e6,
          durationMs: (endNs - startNs) / 1e6,
          // OTLP status code 2 is ERROR; 0/1 are UNSET/OK.
          isError: s.status?.code === 2 || s.status?.code === "STATUS_CODE_ERROR",
          attributes: attrsToRecord(s.attributes),
        });
      }
    }
  }

  return spans.sort((a, b) => a.startMs - b.startMs);
}
