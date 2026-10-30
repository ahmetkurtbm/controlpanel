import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/grafana", () => ({ promMetricNames: vi.fn() }));

import { promMetricNames } from "@/lib/grafana";
import { callsQuery, freshnessQuery, getAllServiceQueries, getServiceQueries, getServiceSchema, latencyQuery, type ServiceSchema } from "@/lib/metrics-schema";

const names = vi.mocked(promMetricNames);

const schema = (overrides: Partial<ServiceSchema> = {}): ServiceSchema => ({
  service: "app",
  callsMetric: "traces_spanmetrics_calls_total",
  latencyMetric: "traces_spanmetrics_latency",
  latencyIsNative: false,
  available: [],
  ...overrides,
});

beforeEach(() => names.mockReset());

describe("getServiceSchema", () => {
  it("klasik histogramı _bucket adından tanır", async () => {
    names.mockResolvedValue(["traces_spanmetrics_calls_total", "traces_spanmetrics_latency_bucket"]);
    expect(await getServiceSchema("app")).toMatchObject({ latencyMetric: "traces_spanmetrics_latency", latencyIsNative: false });
    expect(names).toHaveBeenCalledWith('{service="app"}');
  });

  it("_bucket yoksa yerel histogram sayar", async () => {
    names.mockResolvedValue(["traces_spanmetrics_duration_seconds"]);
    expect(await getServiceSchema("app")).toMatchObject({ latencyMetric: "traces_spanmetrics_duration_seconds", latencyIsNative: true });
  });

  it("alternatif çağrı metriğini seçer, hiçbiri yoksa varsayılana döner", async () => {
    names.mockResolvedValue(["traces_span_metrics_calls_total"]);
    expect((await getServiceSchema("app")).callsMetric).toBe("traces_span_metrics_calls_total");
    names.mockResolvedValue([]);
    expect(await getServiceSchema("app")).toMatchObject({ callsMetric: "traces_spanmetrics_calls_total", latencyMetric: null });
  });
});

describe("latencyQuery", () => {
  it("klasik histogramda _bucket ve le ile gruplar, saniyeyi ms'ye çevirir", () => {
    expect(latencyQuery(schema(), 0.95)).toBe(
      'histogram_quantile(0.95, sum(rate(traces_spanmetrics_latency_bucket{service="app",span_kind="SPAN_KIND_SERVER"}[5m])) by (le)) * 1000',
    );
  });

  it("yerel histogramda _bucket ve le kullanmaz", () => {
    const query = latencyQuery(schema({ latencyIsNative: true }), 0.5, { by: "span_name" })!;
    expect(query).toContain("traces_spanmetrics_latency{");
    expect(query).toContain("by (span_name)");
    expect(query).not.toContain("le,");
  });

  it("milisaniye metriğini ölçeklemez", () => {
    expect(latencyQuery(schema({ latencyMetric: "traces_spanmetrics_duration_milliseconds" }), 0.5)).not.toContain("* 1000");
  });

  it("histogram yoksa null döner", () => {
    expect(latencyQuery(schema({ latencyMetric: null }), 0.5)).toBeNull();
  });
});

describe("callsQuery ve freshnessQuery", () => {
  it("hata ve gruplama etiketlerini ekler", () => {
    expect(callsQuery(schema(), { errorsOnly: true, by: "span_name" })).toBe(
      'sum(rate(traces_spanmetrics_calls_total{service="app",span_kind="SPAN_KIND_SERVER",status_code="STATUS_CODE_ERROR"}[5m])) by (span_name)',
    );
  });

  it("tazelik sorgusu servisi süzer", () => {
    expect(freshnessQuery(schema())).toContain('traces_spanmetrics_calls_total{service="app"}');
  });
});

describe("getServiceQueries", () => {
  it("histogram yoksa gecikme hazır ayarlarını çıkarır", async () => {
    names.mockResolvedValue(["traces_spanmetrics_calls_total"]);
    const { queries } = await getServiceQueries("app");
    expect(queries.rate).toBeDefined();
    expect(queries.duration_p95).toBeUndefined();
  });

  it("hata veren servisi atlar, diğerlerini döndürür", async () => {
    names.mockImplementation(async (selector) => {
      if (selector.includes("kotu")) throw new Error("zaman aşımı");
      return [];
    });
    const result = await getAllServiceQueries(["iyi", "kotu"]);
    expect(result.map((r) => r.service)).toEqual(["iyi"]);
  });
});
