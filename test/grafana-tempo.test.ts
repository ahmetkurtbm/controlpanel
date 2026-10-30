import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { basicAuthHeader, joinUrl, promQuery } from "@/lib/grafana";
import { isDemoMode } from "@/lib/mode";
import { tempoSearch, tempoTrace } from "@/lib/tempo";

const CREDENTIALS = {
  GRAFANA_PROM_URL: "https://prom.test/api/prom",
  GRAFANA_PROM_USER: "1",
  GRAFANA_LOKI_URL: "https://loki.test",
  GRAFANA_LOKI_USER: "2",
  GRAFANA_API_TOKEN: "token",
  GRAFANA_TEMPO_URL: "https://tempo.test/tempo",
  GRAFANA_TEMPO_USER: "3",
};

function useRealMode() {
  vi.stubEnv("CONTROLPANEL_DEMO", "");
  for (const [key, value] of Object.entries(CREDENTIALS)) vi.stubEnv(key, value);
}

beforeEach(() => {
  for (const key of Object.keys(CREDENTIALS)) vi.stubEnv(key, "");
  vi.stubEnv("CONTROLPANEL_DEMO", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("isDemoMode", () => {
  it("kimlik bilgisi yoksa demo çalışır", () => {
    expect(isDemoMode()).toBe(true);
  });

  it("tüm kimlik bilgileri varsa gerçek moda geçer", () => {
    useRealMode();
    expect(isDemoMode()).toBe(false);
  });

  it("CONTROLPANEL_DEMO=1 kimlik bilgisi olsa da demoyu zorlar", () => {
    useRealMode();
    vi.stubEnv("CONTROLPANEL_DEMO", "1");
    expect(isDemoMode()).toBe(true);
  });
});

describe("joinUrl ve basicAuthHeader", () => {
  it("adresin kendi yol önekini korur", () => {
    expect(joinUrl("https://prom.test/api/prom/", "/api/v1/query").href).toBe("https://prom.test/api/prom/api/v1/query");
  });

  it("kullanıcı ve token'ı Basic Auth olarak kodlar", () => {
    useRealMode();
    expect(basicAuthHeader("42").Authorization).toBe(`Basic ${Buffer.from("42:token").toString("base64")}`);
  });
});

describe("promQuery", () => {
  it("gerçek modda doğru adrese kimlikle gider", async () => {
    useRealMode();
    const fetchMock = vi.fn<(url: URL, init: RequestInit) => Promise<Response>>(async () => new Response('{"status":"success"}'));
    vi.stubGlobal("fetch", fetchMock);
    await promQuery("up");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url.href).toBe("https://prom.test/api/prom/api/v1/query?query=up");
    expect((init.headers as Record<string, string>).Authorization).toContain("Basic ");
  });

  it("başarısız yanıtta hata fırlatır", async () => {
    useRealMode();
    vi.stubGlobal("fetch", async () => new Response("yasak", { status: 403 }));
    await expect(promQuery("up")).rejects.toThrow("Prometheus query failed: 403 yasak");
  });

  it("demo modunda ağa çıkmaz ve aynı biçimde yanıt verir", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await promQuery('sum(rate(x{service="gastroflow"}[5m]))');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.status).toBe("success");
    expect(result.data.result[0].metric.service).toBe("gastroflow");
    expect(Number(result.data.result[0].value![1])).toBeGreaterThan(0);
  });
});

describe("tempoSearch", () => {
  it("süzgeçleri TraceQL'e çevirir", async () => {
    useRealMode();
    const fetchMock = vi.fn<(url: URL, init: RequestInit) => Promise<Response>>(async () => new Response('{"traces":[{"traceID":"t1"}]}'));
    vi.stubGlobal("fetch", fetchMock);
    const traces = await tempoSearch({ service: "app", minutes: 10, errorsOnly: true, minDurationMs: 500 });
    expect(traces).toEqual([{ traceID: "t1" }]);
    expect(fetchMock.mock.calls[0][0].searchParams.get("q")).toBe('{ resource.service.name = "app" && status = error && duration > 500ms }');
  });

  it("demo modunda süzgeçlere uyar", async () => {
    const slow = await tempoSearch({ service: "receiptflow", minutes: 60, minDurationMs: 2000, limit: 5 });
    expect(slow.length).toBeGreaterThan(0);
    expect(slow.every((trace) => trace.durationMs! >= 2000)).toBe(true);
    expect(slow.length).toBeLessThanOrEqual(5);
  });
});

describe("tempoTrace", () => {
  it("OTLP yanıtını düz span listesine çevirip sıralar", async () => {
    useRealMode();
    vi.stubGlobal("fetch", async () =>
      new Response(
        JSON.stringify({
          batches: [
            {
              resource: { attributes: [{ key: "service.name", value: { stringValue: "app" } }] },
              scopeSpans: [
                {
                  spans: [
                    { spanId: "b", name: "db", startTimeUnixNano: "2000000", endTimeUnixNano: "5000000", kind: 3, status: { code: "STATUS_CODE_ERROR" }, parentSpanId: "a", attributes: [{ key: "n", value: { intValue: 7 } }] },
                    { spanId: "a", startTimeUnixNano: "1000000", endTimeUnixNano: "9000000", kind: "SERVER", attributes: [{ key: "ok", value: { boolValue: false } }, { key: "bos" }] },
                  ],
                },
              ],
            },
            { scopeSpans: [{ spans: [{ spanId: "c", startTimeUnixNano: "3000000", endTimeUnixNano: "3000000", status: { code: 2 } }] }] },
          ],
        }),
      ),
    );
    const spans = await tempoTrace("id");
    expect(spans.map((span) => span.spanId)).toEqual(["a", "b", "c"]);
    expect(spans[0]).toMatchObject({ name: "(isimsiz)", serviceName: "app", kind: "SERVER", durationMs: 8, isError: false, attributes: { ok: "false" } });
    expect(spans[1]).toMatchObject({ kind: "CLIENT", isError: true, parentSpanId: "a", attributes: { n: "7" } });
    expect(spans[2]).toMatchObject({ serviceName: "bilinmiyor", isError: true });
  });

  it("demo listesindeki iz detayda da bulunur", async () => {
    const [trace] = await tempoSearch({ service: "kidsacademy", minutes: 60, limit: 1 });
    const spans = await tempoTrace(trace.traceID);
    expect(spans[0]).toMatchObject({ serviceName: "kidsacademy", name: trace.rootTraceName, durationMs: trace.durationMs });
  });
});
